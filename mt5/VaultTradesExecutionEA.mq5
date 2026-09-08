#property strict
#property version   "1.0"
#property description "VaultTrades MT5 execution bridge. Polls the VaultTrades queue and optionally executes on the attached MT5 account."

#include <Trade/Trade.mqh>

CTrade trade;

input string InpVaultTradesBaseUrl = "https://vaulttrades.vercel.app";
input string InpAccessKey = "";
input string InpWorkerId = "mt5-ea";
input int    InpPollSeconds = 5;
input string InpExecutionMode = "OBSERVE";
input bool   InpEnableLiveExecution = false;
input double InpVolume = 0.01;
input int    InpDeviationPoints = 30;
input bool   InpOnlyAttachedSymbol = true;

string g_last_error = "";

string Trim(string value)
{
   StringTrimLeft(value);
   StringTrimRight(value);
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
   string mode = InpExecutionMode;
   StringToUpper(mode);
   if(mode != "OBSERVE" && mode != "LIVE")
   {
      Print("VaultTrades EA: InpExecutionMode must be OBSERVE or LIVE.");
      return false;
   }
   if(InpPollSeconds < 1) return false;
   if(InpVolume <= 0) return false;
   return true;
}

bool SymbolAllowed(string jobSymbol)
{
   if(!InpOnlyAttachedSymbol) return true;
   string attached = _Symbol;
   string a = attached;
   string b = jobSymbol;
   StringToUpper(a);
   StringToUpper(b);
   return (a == b);
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

bool ExecuteJob(string json, string queueId)
{
   string direction = JsonString(json, "direction");
   string jobSymbol = JsonString(json, "symbol");
   double sl = JsonNumber(json, "stop_loss");
   double tp = JsonNumber(json, "tp1");

   StringToUpper(direction);
   if(direction != "BUY" && direction != "SELL")
   {
      SendAck(queueId, "failed", "", "Invalid direction");
      return false;
   }
   if(jobSymbol == "" || sl <= 0 || tp <= 0)
   {
      SendAck(queueId, "failed", "", "Invalid symbol, stop_loss or tp1");
      return false;
   }
   if(!SymbolAllowed(jobSymbol))
   {
      SendAck(queueId, "failed", "", "Job symbol does not match attached MT5 symbol");
      return false;
   }

   if(InpExecutionMode == "OBSERVE")
   {
      Print("VaultTrades EA OBSERVE: queue=", queueId, " symbol=", jobSymbol, " direction=", direction, " SL=", DoubleToString(sl, _Digits), " TP=", DoubleToString(tp, _Digits));
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

   string symbol = _Symbol;
   MqlTick tick;
   if(!SymbolInfoTick(symbol, tick))
   {
      SendAck(queueId, "failed", "", "Unable to read market tick");
      return false;
   }

   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(symbol);

   bool sent = false;
   if(direction == "BUY")
      sent = trade.Buy(InpVolume, symbol, 0.0, sl, tp, "VaultTrades " + queueId);
   else
      sent = trade.Sell(InpVolume, symbol, 0.0, sl, tp, "VaultTrades " + queueId);

   if(!sent)
   {
      string reason = trade.ResultRetcodeDescription();
      SendAck(queueId, "failed", "", reason);
      return false;
   }

   string ticket = IntegerToString((long)trade.ResultOrder());
   if(ticket == "0") ticket = IntegerToString((long)trade.ResultDeal());
   if(ticket == "0") ticket = trade.ResultRetcodeDescription();

   Print("VaultTrades EA: DEMO/LIVE order accepted. queue=", queueId, " reference=", ticket);
   return SendAck(queueId, "executed", ticket, "");
}

void PollQueue()
{
   string mode = InpExecutionMode;
   StringToUpper(mode);

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

   string available = JsonString(response, "available");
   if(available == "false" || available == "") return;

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
   EventSetTimer(InpPollSeconds);
   Print("VaultTrades EA initialized. mode=", InpExecutionMode, " worker=", InpWorkerId, " symbol=", _Symbol);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   PollQueue();
}
