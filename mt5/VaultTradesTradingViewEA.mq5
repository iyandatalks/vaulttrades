//+------------------------------------------------------------------+
//| VaultTradesTradingViewEA.mq5                                    |
//| TradingView -> VaultTrades webhook -> MT5                       |
//+------------------------------------------------------------------+
#property strict
#property version "1.10"
#property description "VaultTrades TradingView signal receiver for OBSERVE/LIVE MT5 execution."

#include <Trade/Trade.mqh>
CTrade trade;

input string InpWebhookURL = "https://vaulttradesve.com/api/execution/tradingview";
input string InpWebhookSecret = "";
input string InpStrategyID = "ema20-pullback-morning-engine";
input string InpExecutionMode = "OBSERVE";
input string InpSymbolMapping = "XAUUSD";
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
   while(p<StringLen(json) && (StringGetCharacter(json,p)==' ' || StringGetCharacter(json,p)=='\t')) p++;
   if(p>=StringLen(json) || StringGetCharacter(json,p)!='\"') return "";
   p++;
   int e=p;
   while(e<StringLen(json))
   {
      if(StringGetCharacter(json,e)=='\"' && (e==p || StringGetCharacter(json,e-1)!='\\')) break;
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
      if(c=='{') depth++;
      else if(c=='}')
      {
         depth--;
         if(depth==0) return StringSubstr(json,start,i-start+1);
      }
   }
   return "";
}

string NormalizedMode()
{
   string mode=InpExecutionMode;
   StringToUpper(mode);
   if(mode!="LIVE") mode="OBSERVE";
   return mode;
}

string BrokerSymbol(const string signalSymbol)
{
   string mapped=InpSymbolMapping;
   StringTrimLeft(mapped);
   StringTrimRight(mapped);
   if(mapped!="") return mapped;

   if(signalSymbol!="") return signalSymbol;
   return "XAUUSD";
}

string Poll()
{
   string mode=NormalizedMode();
   string url=InpWebhookURL+
              "?strategy_id="+InpStrategyID+
              "&symbol=XAUUSD"+
              "&execution_mode="+mode;

   string headers="Accept: application/json\r\n"+
                  "X-VaultTrades-Webhook-Secret: "+InpWebhookSecret+"\r\n";

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
      Print("VaultTrades poll HTTP=",status,
            " response=",CharArrayToString(result));
      return "";
   }

   return CharArrayToString(result);
}

bool PostAck(const string signalId,const ulong ticket)
{
   string headers="Content-Type: application/json\r\n"+
                  "X-VaultTrades-Webhook-Secret: "+InpWebhookSecret+"\r\n";

   string body="{\"signal_id\":\""+signalId+
               "\",\"event\":\"MT5_ACK\""+
               ",\"ticket\":"+IntegerToString((long)ticket)+
               ",\"source\":\"MT5\"}";

   char data[];
   StringToCharArray(body,data,0,-1,CP_UTF8);

   char result[];
   string resultHeaders;

   int status=WebRequest("POST",InpWebhookURL,headers,5000,data,result,resultHeaders);

   if(status!=200)
   {
      Print("VaultTrades ACK failed HTTP=",status,
            " response=",CharArrayToString(result));
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

   if(signalId=="") return false;
   if(signalId==g_lastSignalId) return false;

   string configuredMode=NormalizedMode();

   if(mode!=configuredMode)
   {
      Print("VaultTrades mode mismatch. EA=",configuredMode,
            " signal=",mode," signal_id=",signalId);
      return false;
   }

   string brokerSymbol=BrokerSymbol(sourceSymbol);

   if(configuredMode=="OBSERVE")
   {
      Print("VaultTrades OBSERVE signal received: signal_id=",signalId,
            " direction=",direction,
            " TradingViewSymbol=",sourceSymbol,
            " MT5Symbol=",brokerSymbol,
            " entry=",DoubleToString(entry,5),
            " SL=",DoubleToString(sl,5),
            " TP1=",DoubleToString(tp,5));
      g_lastSignalId=signalId;
      return true;
   }

   if(!SymbolSelect(brokerSymbol,true))
   {
      Print("VaultTrades LIVE symbol unavailable: ",brokerSymbol,
            ". Check InpSymbolMapping against the exact MT5 Market Watch symbol.");
      return false;
   }

   if(sl<=0 || tp<=0 || entry<=0)
   {
      Print("VaultTrades LIVE invalid signal: ",signal);
      return false;
   }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(brokerSymbol);

   bool ok=false;

   if(direction=="BUY")
      ok=trade.Buy(InpLots,brokerSymbol,0.0,sl,tp,"VaultTrades "+signalId);
   else if(direction=="SELL")
      ok=trade.Sell(InpLots,brokerSymbol,0.0,sl,tp,"VaultTrades "+signalId);
   else
   {
      Print("VaultTrades invalid direction: ",direction);
      return false;
   }

   if(!ok)
   {
      Print("VaultTrades LIVE order failed retcode=",trade.ResultRetcode(),
            " ",trade.ResultRetcodeDescription());
      return false;
   }

   ulong ticket=trade.ResultOrder();
   g_lastSignalId=signalId;
   PostAck(signalId,ticket);

   Print("VaultTrades LIVE executed: signal_id=",signalId,
         " direction=",direction,
         " MT5Symbol=",brokerSymbol,
         " entry=",DoubleToString(entry,5),
         " SL=",DoubleToString(sl,5),
         " TP1=",DoubleToString(tp,5),
         " ticket=",ticket);

   return true;
}

void PollSignal()
{
   string response=Poll();
   if(response=="") return;

   string signal=ExtractFirstObject(response);
   if(signal=="") return;

   string signalId=JsonString(signal,"signal_id");
   if(signalId=="") return;

   ExecuteSignal(signal);
}

int OnInit()
{
   string mode=NormalizedMode();

   if(InpWebhookSecret=="")
      Print("WARNING: InpWebhookSecret is empty.");

   if(InpSymbolMapping=="")
      Print("WARNING: InpSymbolMapping is empty; EA will use the TradingView symbol.");

   Print("VaultTrades EA initialized. Mode=",mode,
         " StrategyID=",InpStrategyID,
         " MT5SymbolMapping=",InpSymbolMapping,
         " Webhook=",InpWebhookURL);

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
