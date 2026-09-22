//+------------------------------------------------------------------+
//| VaultTradesTradingViewEA.mq5                                    |
//| TradingView -> VaultTrades -> MT5                               |
//+------------------------------------------------------------------+
#property strict
#property version "2.00"
#property description "VaultTrades production TradingView bridge. OBSERVE by default; tick Enable Live Execution for LIVE."

#include <Trade/Trade.mqh>
CTrade trade;

// PRODUCTION ENDPOINT — DO NOT CHANGE.
// TradingView -> VaultTrades app -> MT5 signal polling.
const string VAULTTRADES_EXECUTION_URL = "https://vaulttradesve.com/api/execution/tradingview";

input string InpWebhookSecret = "";
input string InpStrategyID = "ema20-pullback-morning-engine";

// ONE operational switch:
// unchecked = OBSERVE
// checked   = LIVE
input bool InpEnableLiveExecution = false;

input string InpTradingViewSymbol = "XAUUSD";
input string InpMT5SymbolMapping = "XAUUSD";
input double InpLots = 0.01;
input int InpPollSeconds = 2;
input int InpDeviationPoints = 50;
input long InpMagicNumber = 20260922;

string g_lastSignalId = "";
datetime g_lastPoll = 0;

string JsonString(const string json,const string key)
{
   string needle="\"" + key + "\":";
   int p=StringFind(json,needle);
   if(p<0) return "";
   p+=StringLen(needle);

   while(p<StringLen(json) &&
         (StringGetCharacter(json,p)==' ' || StringGetCharacter(json,p)=='\t'))
      p++;

   if(p>=StringLen(json) || StringGetCharacter(json,p)!='\"')
      return "";

   p++;
   int e=p;

   while(e<StringLen(json))
   {
      if(StringGetCharacter(json,e)=='\"' &&
         (e==p || StringGetCharacter(json,e-1)!='\\'))
         break;
      e++;
   }

   if(e>=StringLen(json)) return "";
   return StringSubstr(json,p,e-p);
}

double JsonNumber(const string json,const string key)
{
   string needle="\"" + key + "\":";
   int p=StringFind(json,needle);
   if(p<0) return 0.0;

   p+=StringLen(needle);

   while(p<StringLen(json) &&
         (StringGetCharacter(json,p)==' ' || StringGetCharacter(json,p)=='\t'))
      p++;

   int e=p;

   while(e<StringLen(json))
   {
      ushort c=StringGetCharacter(json,e);
      if((c>='0'&&c<='9') || c=='-' || c=='+' ||
         c=='.' || c=='e' || c=='E')
         e++;
      else
         break;
   }

   return StringToDouble(StringSubstr(json,p,e-p));
}

string ExtractFirstObject(const string json)
{
   int start=StringFind(json,"{");
   if(start<0) return "";

   int depth=0;
   bool inString=false;
   bool escaped=false;

   for(int i=start;i<StringLen(json);i++)
   {
      ushort c=StringGetCharacter(json,i);

      if(inString)
      {
         if(escaped) { escaped=false; continue; }
         if(c=='\\') { escaped=true; continue; }
         if(c=='\"') inString=false;
         continue;
      }

      if(c=='\"') { inString=true; continue; }

      if(c=='{')
         depth++;
      else if(c=='}')
      {
         depth--;
         if(depth==0)
            return StringSubstr(json,start,i-start+1);
      }
   }

   return "";
}

string ResolveMT5Symbol()
{
   string mapped=InpMT5SymbolMapping;
   StringTrimLeft(mapped);
   StringTrimRight(mapped);

   // Exact mapping wins.
   if(mapped!="" && SymbolSelect(mapped,true))
      return mapped;

   // Automatic XAUUSD broker-suffix resolution.
   string base=InpTradingViewSymbol;
   if(base=="") base="XAUUSD";

   if(SymbolSelect(base,true))
      return base;

   int total=SymbolsTotal(false);

   for(int i=0;i<total;i++)
   {
      string candidate=SymbolName(i,false);
      string upper=candidate;
      StringToUpper(upper);

      if(StringFind(upper,base)==0)
      {
         if(SymbolSelect(candidate,true))
            return candidate;
      }
   }

   // Search all symbols, including hidden Market Watch symbols.
   total=SymbolsTotal(true);

   for(int j=0;j<total;j++)
   {
      string candidate2=SymbolName(j,true);
      string upper2=candidate2;
      StringToUpper(upper2);

      if(StringFind(upper2,base)==0)
      {
         if(SymbolSelect(candidate2,true))
            return candidate2;
      }
   }

   return "";
}

string CurrentMode()
{
   if(InpEnableLiveExecution)
      return "LIVE";
   return "OBSERVE";
}

string Poll()
{
   string mode=CurrentMode();

   string url=VAULTTRADES_EXECUTION_URL+
              "?strategy_id="+InpStrategyID+
              "&symbol="+InpTradingViewSymbol+
              "&execution_mode="+mode;

   string headers="Accept: application/json\r\n"+
                  "X-VaultTrades-Webhook-Secret: "+InpWebhookSecret+"\r\n";

   char data[];
   char result[];
   string resultHeaders;

   ResetLastError();

   int status=WebRequest(
      "GET",
      url,
      headers,
      5000,
      data,
      result,
      resultHeaders
   );

   if(status==-1)
   {
      Print(
         "VaultTrades WebRequest failed. Error=",
         GetLastError(),
         ". MT5 must allow: https://vaulttradesve.com"
      );
      return "";
   }

   if(status!=200)
   {
      Print(
         "VaultTrades bridge HTTP=",
         status,
         " response=",
         CharArrayToString(result)
      );
      return "";
   }

   return CharArrayToString(result);
}

bool PostAck(const string signalId,const ulong ticket)
{
   string headers=
      "Content-Type: application/json\r\n"+
      "X-VaultTrades-Webhook-Secret: "+InpWebhookSecret+"\r\n";

   string body=
      "{\"signal_id\":\""+signalId+
      "\",\"event\":\"MT5_ACK\""+
      ",\"ticket\":"+IntegerToString((long)ticket)+
      ",\"source\":\"MT5\"}";

   char data[];
   StringToCharArray(body,data,0,-1,CP_UTF8);

   char result[];
   string resultHeaders;

   int status=WebRequest(
      "POST",
      VAULTTRADES_EXECUTION_URL,
      headers,
      5000,
      data,
      result,
      resultHeaders
   );

   if(status!=200)
   {
      Print(
         "VaultTrades ACK failed HTTP=",
         status,
         " response=",
         CharArrayToString(result)
      );
      return false;
   }

   return true;
}

bool ExecuteSignal(const string signal)
{
   string signalId=JsonString(signal,"signal_id");
   string direction=JsonString(signal,"direction");
   string sourceSymbol=JsonString(signal,"symbol");
   string mode=JsonString(signal,"execution_mode");

   double entry=JsonNumber(signal,"entry_price");
   double sl=JsonNumber(signal,"stop_loss");
   double tp=JsonNumber(signal,"tp1");

   if(signalId=="")
      return false;

   if(signalId==g_lastSignalId)
      return false;

   string expectedMode=CurrentMode();

   if(mode!=expectedMode)
   {
      Print(
         "VaultTrades mode mismatch. EA=",
         expectedMode,
         " signal=",
         mode,
         " signal_id=",
         signalId
      );
      return false;
   }

   string brokerSymbol=ResolveMT5Symbol();

   if(brokerSymbol=="")
   {
      Print(
         "VaultTrades cannot resolve MT5 gold symbol. TradingView=",
         InpTradingViewSymbol,
         " mapping=",
         InpMT5SymbolMapping
      );
      return false;
   }

   // OBSERVE never places an order.
   if(expectedMode=="OBSERVE")
   {
      Print(
         "VaultTrades OBSERVE RECEIVED | signal_id=",
         signalId,
         " | direction=",
         direction,
         " | TV=",
         sourceSymbol,
         " | MT5=",
         brokerSymbol,
         " | entry=",
         DoubleToString(entry,5),
         " | SL=",
         DoubleToString(sl,5),
         " | TP1=",
         DoubleToString(tp,5)
      );

      g_lastSignalId=signalId;
      return true;
   }

   if(sl<=0 || tp<=0 || entry<=0)
   {
      Print("VaultTrades LIVE rejected invalid prices. signal_id=",signalId);
      return false;
   }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(brokerSymbol);

   bool ok=false;

   if(direction=="BUY")
      ok=trade.Buy(
         InpLots,
         brokerSymbol,
         0.0,
         sl,
         tp,
         "VaultTrades "+signalId
      );
   else if(direction=="SELL")
      ok=trade.Sell(
         InpLots,
         brokerSymbol,
         0.0,
         sl,
         tp,
         "VaultTrades "+signalId
      );
   else
   {
      Print("VaultTrades invalid direction=",direction);
      return false;
   }

   if(!ok)
   {
      Print(
         "VaultTrades LIVE order failed. retcode=",
         trade.ResultRetcode(),
         " ",
         trade.ResultRetcodeDescription()
      );
      return false;
   }

   ulong ticket=trade.ResultOrder();

   g_lastSignalId=signalId;

   PostAck(signalId,ticket);

   Print(
      "VaultTrades LIVE EXECUTED | signal_id=",
      signalId,
      " | direction=",
      direction,
      " | MT5=",
      brokerSymbol,
      " | ticket=",
      ticket
   );

   return true;
}

void PollSignal()
{
   string response=Poll();

   if(response=="")
      return;

   string signal=ExtractFirstObject(response);

   if(signal=="")
      return;

   ExecuteSignal(signal);
}

int OnInit()
{
   if(InpWebhookSecret=="")
      Print("WARNING: VaultTrades webhook secret is empty.");

   string brokerSymbol=ResolveMT5Symbol();

   Print(
      "VaultTrades EA READY | endpoint=",
      VAULTTRADES_EXECUTION_URL,
      " | strategy=",
      InpStrategyID,
      " | mode=",
      CurrentMode(),
      " | TradingView symbol=",
      InpTradingViewSymbol,
      " | MT5 symbol=",
      brokerSymbol
   );

   EventSetTimer(MathMax(1,InpPollSeconds));

   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   if((TimeCurrent()-g_lastPoll)<InpPollSeconds)
      return;

   g_lastPoll=TimeCurrent();

   PollSignal();
}
