#property strict
#property version   "1.2"
#property description "VaultTrades MT5 execution bridge. Polls the VaultTrades queue and manages staged TP1/TP2 execution."

#include <Trade/Trade.mqh>

CTrade trade;

input string InpVaultTradesBaseUrl = "https://vaulttradesve.com";
input string InpAccessKey = "";
input string InpWorkerId = "mt5-ea";
input int    InpPollSeconds = 5;
input string InpExecutionMode = "OBSERVE";
input bool   InpEnableLiveExecution = false;
input double InpVolume = 0.03;
input double InpTP1CloseVolume = 0.02;
input double InpRunnerVolume = 0.01;
input bool   InpMoveStopToBE = true;
input int    InpDeviationPoints = 30;
input bool   InpOnlyAttachedSymbol = true;
input long   InpMagicNumber = 26091701;
// Optional TradingView -> broker symbol mapping, e.g. "XAUUSD=GOLD,XAGUSD=SILVER"
input string InpSymbolMap = "";

string g_last_error = "";

string Trim(string value)
{
   StringTrimLeft(value);
   StringTrimRight(value);
   return value;
}

string Upper(string value)
{
   StringToUpper(value);
   return value;
}

string JsonString(string json, string key)
{
   string needle = "\"" + key + "\"";
   int p = StringFind(json, needle);
   if(p < 0) return "";
   p = StringFind(json, ":", p + StringLen(needle));
   if(p < 0) return "";
   p++;
   while(p < StringLen(json) && (StringGetCharacter(json, p) == ' ' || StringGetCharacter(json, p) == '\t')) p++;
   if(p >= StringLen(json) || StringGetCharacter(json, p) != '\"') return "";
   p++;
   int end = p;
   while(end < StringLen(json))
   {
      if(StringGetCharacter(json, end) == '\"' && (end == p || StringGetCharacter(json, end - 1) != '\\')) break;
      end++;
   }
   if(end >= StringLen(json)) return "";
   return StringSubstr(json, p, end - p);
}

double JsonNumber(string json, string key)
{
   string needle = "\"" + key + "\"";
   int p = StringFind(json, needle);
   if(p < 0) return 0.0;
   p = StringFind(json, ":", p + StringLen(needle));
   if(p < 0) return 0.0;
   p++;
   while(p < StringLen(json) && (StringGetCharacter(json, p) == ' ' || StringGetCharacter(json, p) == '\t')) p++;
   int end = p;
   while(end < StringLen(json))
   {
      ushort c = StringGetCharacter(json, end);
      if((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') end++;
      else break;
   }
   if(end <= p) return 0.0;
   return StringToDouble(StringSubstr(json, p, end - p));
}

bool JsonBool(string json, string key)
{
   string needle = "\"" + key + "\"";
   int p = StringFind(json, needle);
   if(p < 0) return false;
   p = StringFind(json, ":", p + StringLen(needle));
   if(p < 0) return false;
   p++;
   while(p < StringLen(json) && (StringGetCharacter(json, p) == ' ' || StringGetCharacter(json, p) == '\t')) p++;
   string tail = Upper(StringSubstr(json, p, 5));
   return StringFind(tail, "TRUE") == 0;
}

bool PostJson(string path, string body, string &response, int &httpCode)
{
   char post[];
   char result[];
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
   ResetLastError();
   int copied = StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied > 0) ArrayResize(post, copied - 1);

   string resultHeaders = "";
   httpCode = WebRequest("POST", InpVaultTradesBaseUrl + path, headers, 15000, post, result, resultHeaders);
   if(httpCode == -1)
   {
      g_last_error = "WebRequest failed: " + IntegerToString(GetLastError());
      response = "";
      return false;
   }

   response = CharArrayToString(result, 0, -1, CP_UTF8);
   return true;
}

bool IsConfigured()
{
   if(Trim(InpAccessKey) == "")
   {
      Print("VaultTrades EA: InpAccessKey is empty.");
      return false;
   }

   string mode = Upper(Trim(InpExecutionMode));
   if(mode != "OBSERVE" && mode != "LIVE")
   {
      Print("VaultTrades EA: InpExecutionMode must be OBSERVE or LIVE.");
      return false;
   }
   if(InpPollSeconds < 1) return false;
   if(InpVolume <= 0) return false;
   if(InpTP1CloseVolume <= 0) return false;
   if(InpRunnerVolume <= 0) return false;
   if(InpVolume + 0.0000001 < InpTP1CloseVolume + InpRunnerVolume) return false;
   if(Trim(InpVaultTradesBaseUrl) == "") return false;
   return true;
}

string MapSignalSymbol(string jobSymbol)
{
   string wanted = Upper(Trim(jobSymbol));
   if(Trim(InpSymbolMap) == "") return wanted;

   string pairs[];
   int count = StringSplit(InpSymbolMap, ',', pairs);
   for(int i = 0; i < count; i++)
   {
      string pair = Trim(pairs[i]);
      int eq = StringFind(pair, "=");
      if(eq <= 0) continue;
      string from = Upper(Trim(StringSubstr(pair, 0, eq)));
      string to = Upper(Trim(StringSubstr(pair, eq + 1)));
      if(from == wanted && to != "") return to;
   }
   return wanted;
}

bool SymbolAllowed(string jobSymbol, string &executionSymbol)
{
   executionSymbol = MapSignalSymbol(jobSymbol);
   if(!InpOnlyAttachedSymbol) return true;

   string attached = Upper(_Symbol);
   if(attached == executionSymbol) return true;

   Print("VaultTrades EA: symbol mismatch. Signal=", jobSymbol,
         " mapped=", executionSymbol, " attached=", _Symbol,
         ". Configure InpSymbolMap if the broker uses a different symbol name.");
   return false;
}

double NormalizeVolume(string symbol, double volume)
{
   double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   if(step <= 0) step = 0.01;
   volume = MathMax(minLot, MathMin(maxLot, volume));
   volume = MathFloor((volume + 0.000000001) / step) * step;
   return NormalizeDouble(volume, 2);
}

bool SendAck(string queueId, string status, string executionReference, string failureReason)
{
   string body = "{";
   body += "\"access_key\":\"" + InpAccessKey + "\",";
   body += "\"queue_id\":\"" + queueId + "\",";
   body += "\"worker_id\":\"" + InpWorkerId + "\",";
   body += "\"status\":\"" + status + "\"";
   if(executionReference != "") body += ",\"execution_reference\":\"" + executionReference + "\"";
   if(failureReason != "") body += ",\"failure_reason\":\"" + failureReason + "\"";
   body += "}";

   string response;
   int code = 0;
   bool ok = PostJson("/api/execution/mt5/ack", body, response, code);
   if(!ok || code < 200 || code >= 300)
   {
      Print("VaultTrades EA: acknowledgement failed. HTTP=", code, " response=", response, " error=", g_last_error);
      return false;
   }
   return true;
}

string CompactTradeComment(string queueId, double tp1)
{
   string shortId = queueId;
   if(StringLen(shortId) > 8) shortId = StringSubstr(shortId, StringLen(shortId) - 8);
   return "VT|" + shortId + "|" + DoubleToString(tp1, _Digits);
}

double CommentTP1(string comment)
{
   if(StringFind(comment, "VT|") != 0) return 0.0;
   int first = StringFind(comment, "|");
   if(first < 0) return 0.0;
   int second = StringFind(comment, "|", first + 1);
   if(second < 0) return 0.0;
   string value = StringSubstr(comment, second + 1);
   return StringToDouble(value);
}

bool ClosePartial(ulong ticket, string symbol, ENUM_POSITION_TYPE positionType, double volume)
{
   double currentVolume = PositionGetDouble(POSITION_VOLUME);
   double closeVolume = NormalizeVolume(symbol, MathMin(volume, currentVolume));
   if(closeVolume <= 0 || closeVolume >= currentVolume + 0.0000001)
   {
      Print("VaultTrades EA: invalid partial-close volume. current=", DoubleToString(currentVolume, 2), " requested=", DoubleToString(volume, 2));
      return false;
   }

   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(symbol);

   bool hedging = ((ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE) == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING);
   bool sent = false;

   if(hedging)
   {
      sent = trade.PositionClosePartial(ticket, closeVolume, InpDeviationPoints);
   }
   else
   {
      if(positionType == POSITION_TYPE_BUY)
         sent = trade.Sell(closeVolume, symbol, 0.0, 0.0, 0.0, "VaultTrades TP1");
      else
         sent = trade.Buy(closeVolume, symbol, 0.0, 0.0, 0.0, "VaultTrades TP1");
   }

   if(!sent)
   {
      Print("VaultTrades EA: TP1 partial close failed. ticket=", ticket, " retcode=", trade.ResultRetcode(), " reason=", trade.ResultRetcodeDescription());
      return false;
   }

   uint retcode = trade.ResultRetcode();
   if(retcode != TRADE_RETCODE_DONE && retcode != TRADE_RETCODE_DONE_PARTIAL)
   {
      Print("VaultTrades EA: TP1 partial close rejected. retcode=", retcode, " reason=", trade.ResultRetcodeDescription());
      return false;
   }

   return true;
}

void ManageOpenPositions()
{
   string mode = Upper(Trim(InpExecutionMode));
   if(mode != "LIVE" || !InpEnableLiveExecution) return;

   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetExpertMagicNumber(InpMagicNumber);

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      long magic = PositionGetInteger(POSITION_MAGIC);
      if(magic != InpMagicNumber) continue;

      string symbol = PositionGetString(POSITION_SYMBOL);
      string comment = PositionGetString(POSITION_COMMENT);
      double tp1 = CommentTP1(comment);
      if(tp1 <= 0) continue;

      ENUM_POSITION_TYPE positionType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      double currentVolume = PositionGetDouble(POSITION_VOLUME);
      double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      if(point <= 0) point = _Point;

      MqlTick tick;
      if(!SymbolInfoTick(symbol, tick)) continue;

      bool tp1Reached = positionType == POSITION_TYPE_BUY ? tick.bid >= tp1 : tick.ask <= tp1;
      if(!tp1Reached) continue;

      // If only the runner remains, TP1 has already been processed.
      if(currentVolume <= NormalizeVolume(symbol, InpRunnerVolume) + 0.0000001)
      {
         if(InpMoveStopToBE && MathAbs(currentSL - openPrice) > point * 2.0)
         {
            if(!trade.PositionModify(ticket, openPrice, currentTP))
               Print("VaultTrades EA: runner BE modification failed. ticket=", ticket, " reason=", trade.ResultRetcodeDescription());
         }
         continue;
      }

      if(currentVolume < NormalizeVolume(symbol, InpTP1CloseVolume + InpRunnerVolume) - 0.0000001)
         continue;

      if(!ClosePartial(ticket, symbol, positionType, InpTP1CloseVolume)) continue;

      if(InpMoveStopToBE)
      {
         if(!trade.PositionModify(ticket, openPrice, currentTP))
            Print("VaultTrades EA: TP1 reached but BE modification failed. ticket=", ticket, " reason=", trade.ResultRetcodeDescription());
         else
            Print("VaultTrades EA: TP1 reached. Closed ", DoubleToString(InpTP1CloseVolume, 2), " lot and moved remaining position to BE. ticket=", ticket);
      }
      else
      {
         Print("VaultTrades EA: TP1 reached. Closed ", DoubleToString(InpTP1CloseVolume, 2), " lot; BE move disabled. ticket=", ticket);
      }
   }
}

bool ExecuteJob(string json, string queueId)
{
   string direction = Upper(JsonString(json, "direction"));
   string jobSymbol = JsonString(json, "symbol");
   double sl = JsonNumber(json, "stop_loss");
   double tp1 = JsonNumber(json, "tp1");
   double tp2 = JsonNumber(json, "tp2");
   string mode = Upper(Trim(InpExecutionMode));

   if(direction != "BUY" && direction != "SELL")
   {
      SendAck(queueId, "failed", "", "Invalid direction");
      return false;
   }
   if(jobSymbol == "" || sl <= 0 || tp1 <= 0)
   {
      SendAck(queueId, "failed", "", "Invalid symbol, stop_loss or tp1");
      return false;
   }
   if(tp2 <= 0) tp2 = tp1;

   string executionSymbol = "";
   if(!SymbolAllowed(jobSymbol, executionSymbol))
   {
      SendAck(queueId, "failed", "", "Job symbol does not match attached MT5 symbol");
      return false;
   }

   if(mode == "OBSERVE")
   {
      Print("VaultTrades EA OBSERVE: queue=", queueId,
            " signal=", jobSymbol, " execution=", executionSymbol,
            " direction=", direction, " entry volume=", DoubleToString(InpVolume, 2),
            " TP1 close=", DoubleToString(InpTP1CloseVolume, 2),
            " runner=", DoubleToString(InpRunnerVolume, 2),
            " SL=", DoubleToString(sl, _Digits),
            " TP1=", DoubleToString(tp1, _Digits),
            " TP2=", DoubleToString(tp2, _Digits));
      return SendAck(queueId, "observed", "", "");
   }

   if(!InpEnableLiveExecution)
   {
      SendAck(queueId, "failed", "", "LIVE mode requested but InpEnableLiveExecution=false");
      return false;
   }

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      SendAck(queueId, "failed", "", "MT5 trading is not allowed");
      return false;
   }

   MqlTick tick;
   if(!SymbolInfoTick(executionSymbol, tick))
   {
      SendAck(queueId, "failed", "", "Unable to read market tick");
      return false;
   }

   double volume = NormalizeVolume(executionSymbol, InpVolume);
   double tp1Close = NormalizeVolume(executionSymbol, InpTP1CloseVolume);
   double runner = NormalizeVolume(executionSymbol, InpRunnerVolume);
   if(volume <= 0 || tp1Close <= 0 || runner <= 0 || volume < tp1Close + runner - 0.0000001)
   {
      SendAck(queueId, "failed", "", "Invalid staged volume configuration for broker lot step");
      return false;
   }

   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(executionSymbol);
   trade.SetExpertMagicNumber(InpMagicNumber);

   string comment = CompactTradeComment(queueId, tp1);
   bool sent = false;
   if(direction == "BUY")
      sent = trade.Buy(volume, executionSymbol, 0.0, sl, tp2, comment);
   else
      sent = trade.Sell(volume, executionSymbol, 0.0, sl, tp2, comment);

   if(!sent)
   {
      string reason = trade.ResultRetcodeDescription();
      SendAck(queueId, "failed", "", reason);
      return false;
   }

   uint retcode = trade.ResultRetcode();
   if(retcode != TRADE_RETCODE_DONE && retcode != TRADE_RETCODE_DONE_PARTIAL && retcode != TRADE_RETCODE_PLACED)
   {
      string reason = trade.ResultRetcodeDescription();
      SendAck(queueId, "failed", "", reason);
      return false;
   }

   string ticket = IntegerToString((long)trade.ResultOrder());
   if(ticket == "0") ticket = IntegerToString((long)trade.ResultDeal());
   if(ticket == "0") ticket = trade.ResultRetcodeDescription();

   Print("VaultTrades EA: staged order accepted. queue=", queueId,
         " reference=", ticket,
         " volume=", DoubleToString(volume, 2),
         " TP1=", DoubleToString(tp1, _Digits),
         " TP2=", DoubleToString(tp2, _Digits));
   return SendAck(queueId, "executed", ticket, "");
}

void PollQueue()
{
   string mode = Upper(Trim(InpExecutionMode));

   string body = "{";
   body += "\"access_key\":\"" + InpAccessKey + "\",";
   body += "\"worker_id\":\"" + InpWorkerId + "\",";
   body += "\"execution_mode\":\"" + mode + "\"";
   body += "}";

   string response;
   int code = 0;
   if(!PostJson("/api/execution/mt5/poll", body, response, code))
   {
      Print("VaultTrades EA poll transport error: ", g_last_error);
      return;
   }
   if(code < 200 || code >= 300)
   {
      Print("VaultTrades EA poll HTTP=", code, " response=", response);
      return;
   }

   if(!JsonBool(response, "available")) return;

   string jobStart = "\"job\":{";
   int p = StringFind(response, jobStart);
   if(p < 0)
   {
      Print("VaultTrades EA: available response did not contain job payload: ", response);
      return;
   }

   string job = StringSubstr(response, p + StringLen("\"job\":"));
   string queueId = JsonString(job, "id");
   if(queueId == "")
   {
      Print("VaultTrades EA: claimed job has no id.");
      return;
   }

   ExecuteJob(job, queueId);
}

int OnInit()
{
   if(!IsConfigured()) return INIT_PARAMETERS_INCORRECT;
   trade.SetExpertMagicNumber(InpMagicNumber);
   EventSetTimer(InpPollSeconds);
   Print("VaultTrades EA initialized. mode=", Upper(Trim(InpExecutionMode)),
         " worker=", InpWorkerId, " symbol=", _Symbol,
         " poll=", InpPollSeconds, "s",
         " volume=", DoubleToString(InpVolume, 2),
         " TP1Close=", DoubleToString(InpTP1CloseVolume, 2),
         " runner=", DoubleToString(InpRunnerVolume, 2));
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   ManageOpenPositions();
   PollQueue();
}
