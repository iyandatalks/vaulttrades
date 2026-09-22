//+------------------------------------------------------------------+
//| VaultTradesTradingViewEA.mq5                                    |
//| TradingView -> VaultTrades webhook -> MT5                       |
//+------------------------------------------------------------------+
#property strict
#property version "1.00"
#property description "Executes LIVE TradingView EMA20 signals received through VaultTrades."

#include <Trade/Trade.mqh>
CTrade trade;

input string InpWebhookURL = "https://vaulttradesve.com/api/execution/tradingview";
input string InpWebhookSecret = "";
input string InpStrategyID = "ema20-pullback-morning-engine";
input string InpSymbol = "XAUUSD";
input double InpLots = 0.01;
input int InpPollSeconds = 2;
input int InpDeviationPoints = 50;
input long InpMagicNumber = 20260922;
input bool InpAllowLiveExecution = false;

string g_lastSignalId = "";
datetime g_lastPoll = 0;

string JsonString(const string json,const string key)
{
   string needle=""" + key + "":";
   int p=StringFind(json,needle);
   if(p<0) return "";
   p+=StringLen(needle);
   while(p<StringLen(json) && (StringGetCharacter(json,p)==' ' || StringGetCharacter(json,p)=='\t')) p++;
   if(p>=StringLen(json) || StringGetCharacter(json,p)!='"') return "";
   p++;
   int e=p;
   while(e<StringLen(json))
   {
      if(StringGetCharacter(json,e)=='"' && (e==p || StringGetCharacter(json,e-1)!='\\')) break;
      e++;
   }
   if(e>=StringLen(json)) return "";
   return StringSubstr(json,p,e-p);
}

double JsonNumber(const string json,const string key)
{
   string needle=""" + key + "":";
   int p=StringFind(json,needle);
   if(p<0) return 0.0;
   p+=StringLen(needle);
   while(p<StringLen(json) && (StringGetCharacter(json,p)==' ' || StringGetCharacter(json,p)=='\t')) p++;
   int e=p;
   while(e<StringLen(json))
   {
      ushort c=StringGetCharacter(json,e);
      if((c>='0'&&c<='9')||c=='-'||c=='+'||c=='.'||c=='e'||c=='E') e++;
      else break;
   }
   return StringToDouble(StringSubstr(json,p,e-p));
}

bool PostAck(const string signalId,const ulong ticket)
{
   string headers="Content-Type: application/json\r\nX-VaultTrades-Webhook-Secret: "+InpWebhookSecret+"\r\n";
   string body="{\"signal_id\":\""+signalId+"\",\"event\":\"MT5_ACK\",\"ticket\":"+IntegerToString((long)ticket)+",\"source\":\"MT5\"}";
   char data[];
   StringToCharArray(body,data,0,-1,CP_UTF8);
   char result[];
   string resultHeaders;
   int status=WebRequest("POST",InpWebhookURL,headers,5000,data,result,resultHeaders);
   if(status!=200)
   {
      Print("VaultTrades ACK failed HTTP=",status," response=",CharArrayToString(result));
      return false;
   }
   return true;
}

string Poll()
{
   string url=InpWebhookURL+"?strategy_id="+InpStrategyID+"&symbol="+InpSymbol+"&execution_mode=LIVE";
   string headers="Accept: application/json\r\nX-VaultTrades-Webhook-Secret: "+InpWebhookSecret+"\r\n";
   char data[];
   char result[];
   string resultHeaders;
   ResetLastError();
   int status=WebRequest("GET",url,headers,5000,data,result,resultHeaders);
   if(status==-1)
   {
      Print("VaultTrades WebRequest error=",GetLastError(),
            ". Add https://vaulttradesve.com in MT5 WebRequest allowed URLs.");
      return "";
   }
   if(status!=200)
   {
      Print("VaultTrades webhook HTTP=",status," response=",CharArrayToString(result));
      return "";
   }
   return CharArrayToString(result);
}

bool Execute(const string signal)
{
   string signalId=JsonString(signal,"signal_id");
   string direction=JsonString(signal,"direction");
   string symbol=JsonString(signal,"symbol");
   string mode=JsonString(signal,"execution_mode");
   double entry=JsonNumber(signal,"entry_price");
   double sl=JsonNumber(signal,"stop_loss");
   double tp=JsonNumber(signal,"tp1");

   if(signalId=="" || signalId==g_lastSignalId) return false;
   if(mode!="LIVE") return false;
   if(!InpAllowLiveExecution)
   {
      Print("VaultTrades OBSERVE: signal=",signalId," direction=",direction,
            " symbol=",symbol," entry=",DoubleToString(entry,_Digits),
            " SL=",DoubleToString(sl,_Digits)," TP1=",DoubleToString(tp,_Digits));
      g_lastSignalId=signalId;
      return false;
   }

   if(symbol=="") symbol=InpSymbol;
   if(!SymbolSelect(symbol,true)) { Print("Symbol unavailable: ",symbol); return false; }
   if(sl<=0 || tp<=0 || entry<=0) { Print("Invalid signal: ",signal); return false; }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(symbol);

   bool ok=false;
   if(direction=="BUY") ok=trade.Buy(InpLots,symbol,0.0,sl,tp,"VaultTrades "+signalId);
   else if(direction=="SELL") ok=trade.Sell(InpLots,symbol,0.0,sl,tp,"VaultTrades "+signalId);
   else return false;

   if(!ok)
   {
      Print("MT5 order failed retcode=",trade.ResultRetcode(),
            " ",trade.ResultRetcodeDescription());
      return false;
   }

   ulong ticket=trade.ResultOrder();
   g_lastSignalId=signalId;
   PostAck(signalId,ticket);

   Print("VaultTrades LIVE executed: ",signalId," ",direction," ",symbol,
         " entry=",DoubleToString(entry,_Digits),
         " SL=",DoubleToString(sl,_Digits),
         " TP1=",DoubleToString(tp,_Digits),
         " ticket=",ticket);
   return true;
}

void PollSignal()
{
   string response=Poll();
   if(response=="") return;

   int p=StringFind(response,""signal_id":");
   if(p<0) return;

   int first=StringFind(response,"{",p);
   int end=StringFind(response,"}",first);
   if(first<0 || end<0) return;

   string signal=StringSubstr(response,first,end-first+1);
   Execute(signal);
}

int OnInit()
{
   if(InpWebhookSecret=="")
      Print("WARNING: InpWebhookSecret is empty.");
   EventSetTimer(MathMax(1,InpPollSeconds));
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   if((TimeCurrent()-g_lastPoll)<InpPollSeconds) return;
   g_lastPoll=TimeCurrent();
   PollSignal();
}
