//+------------------------------------------------------------------+
//| VaultTrades | Customer Copier | Native MT5 EA                    |
//| Receives master trade commands from VaultTrades and executes     |
//| them on the customer's MT5 account.                              |
//+------------------------------------------------------------------+
#property strict
#property version "1.00"
#property description "VaultTrades Customer Copier"
#property description "Native MT5 copy-trading execution bridge"

#include <Trade/Trade.mqh>

CTrade trade;

input string InpApiBaseUrl       = "";      // VaultTrades production API base URL
input string InpPairingCode      = "";      // 10-character code from VaultTrades Copy
input string InpApiToken         = "";      // optional persisted token override
input string InpCopierVersion    = "1.00";
input int    InpPollSeconds      = 2;
input int    InpHeartbeatSeconds = 30;
input int    InpHttpTimeoutMs    = 5000;

input ulong  InpMagicNumber      = 20260923;
input int    InpDeviationPoints  = 50;
input bool   InpAllowTrading     = true;
input bool   InpShowStatus       = true;

string g_baseUrl="";
string g_token="";
string g_followerId="";
string g_tokenFile="";
ulong  g_login=0;
uint   g_lastHeartbeatTick=0;
datetime g_lastStatus=0;

//==================================================================
// JSON HELPERS
//==================================================================
string JsonEscape(string value)
  {
   StringReplace(value,"\\","\\\\");
   StringReplace(value,"\"","\\\"");
   StringReplace(value,"\r","\\r");
   StringReplace(value,"\n","\\n");
   return value;
  }

string JsonStringAt(string json,string key,int fromPos=0)
  {
   string needle="\"" + key + "\":\"";
   int p=StringFind(json,needle,fromPos);
   if(p<0)
      return "";

   int start=p+StringLen(needle);
   string out="";
   bool escaped=false;

   for(int i=start;i<StringLen(json);i++)
     {
      ushort ch=StringGetCharacter(json,i);

      if(escaped)
        {
         if(ch=='n') out+="\n";
         else if(ch=='r') out+="\r";
         else if(ch=='t') out+="\t";
         else out+=(string)CharToString((uchar)ch);
         escaped=false;
         continue;
        }

      if(ch=='\\')
        {
         escaped=true;
         continue;
        }

      if(ch=='"')
         return out;

      out+=(string)CharToString((uchar)ch);
     }

   return "";
  }

double JsonNumberAt(string json,string key,int fromPos=0)
  {
   string needle="\"" + key + "\":";
   int p=StringFind(json,needle,fromPos);
   if(p<0)
      return EMPTY_VALUE;

   int start=p+StringLen(needle);

   while(start<StringLen(json))
     {
      ushort ch=StringGetCharacter(json,start);
      if(ch==' ' || ch=='\t' || ch=='\r' || ch=='\n')
         start++;
      else
         break;
     }

   int end=start;
   while(end<StringLen(json))
     {
      ushort ch=StringGetCharacter(json,end);
      if((ch>='0' && ch<='9') || ch=='-' || ch=='+' ||
         ch=='.' || ch=='e' || ch=='E')
         end++;
      else
         break;
     }

   if(end<=start)
      return EMPTY_VALUE;

   return StringToDouble(StringSubstr(json,start,end-start));
  }

string MapSymbol(string masterSymbol,string settingsJson)
  {
   string needle="\"" + masterSymbol + "\":";
   int p=StringFind(settingsJson,needle);
   if(p<0)
      return masterSymbol;

   int start=p+StringLen(needle);
   while(start<StringLen(settingsJson))
     {
      ushort ch=StringGetCharacter(settingsJson,start);
      if(ch==' ' || ch=='\t' || ch=='\r' || ch=='\n')
         start++;
      else
         break;
     }

   if(start>=StringLen(settingsJson) ||
      StringGetCharacter(settingsJson,start)!='"')
      return masterSymbol;

   return JsonStringAt(settingsJson,masterSymbol);
  }

//==================================================================
// HTTP
//==================================================================
string CleanBaseUrl()
  {
   string s=InpApiBaseUrl;
   while(StringLen(s)>0 && StringGetCharacter(s,StringLen(s)-1)=='/')
      s=StringSubstr(s,0,StringLen(s)-1);
   return s;
  }

bool Http(string method,string endpoint,string body,bool withToken,
          string &response,int &httpCode)
  {
   response="";
   httpCode=-1;

   string base=g_baseUrl;
   if(base=="" || (withToken && g_token==""))
      return false;

   string headers=
      "Content-Type: application/json\r\n"
      "Accept: application/json\r\n";

   if(withToken)
      headers+="x-vaulttrades-copy-token: "+g_token+"\r\n";

   string url=base+endpoint;

   char data[];
   char result[];
   string resultHeaders;

   int copied=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   int dataSize=copied;
   if(dataSize>0 && data[dataSize-1]==0)
      dataSize--;

   ResetLastError();

   httpCode=WebRequest(
      method,
      url,
      headers,
      InpHttpTimeoutMs,
      data,
      dataSize,
      result,
      resultHeaders
   );

   if(httpCode<0)
     {
      PrintFormat("VT Copier: WebRequest failed %s error=%d",
                  endpoint,GetLastError());
      return false;
     }

   response=CharArrayToString(result,0,-1,CP_UTF8);

   if(httpCode<200 || httpCode>=300)
     {
      PrintFormat("VT Copier: HTTP %d %s response=%s",
                  httpCode,endpoint,response);
      return false;
     }

   return true;
  }

//==================================================================
// TOKEN STORAGE
//==================================================================
void SaveToken()
  {
   if(g_token=="")
      return;

   int h=FileOpen(g_tokenFile,
                  FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);

   if(h==INVALID_HANDLE)
     {
      PrintFormat("VT Copier: token save failed error=%d",GetLastError());
      return;
     }

   FileWriteString(h,g_token);
   FileFlush(h);
   FileClose(h);
  }

bool LoadToken()
  {
   int h=FileOpen(g_tokenFile,
                  FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);

   if(h==INVALID_HANDLE)
      return false;

   g_token=FileReadString(h);
   FileClose(h);

   return g_token!="";
  }

//==================================================================
// PAIRING
//==================================================================
bool PairAccount()
  {
   string pairing=InpPairingCode;
   StringToUpper(pairing);

   if(pairing=="")
      return false;

   string body=StringFormat(
      "{\"pairingCode\":\"%s\",\"mtLogin\":\"%I64u\",\"brokerServer\":\"%s\",\"eaVersion\":\"%s\"}",
      JsonEscape(pairing),
      g_login,
      JsonEscape(AccountInfoString(ACCOUNT_SERVER)),
      JsonEscape(InpCopierVersion)
   );

   string response;
   int code;

   if(!Http("POST","/api/copy/pair/redeem",body,false,response,code))
      return false;

   string token=JsonStringAt(response,"token");
   g_followerId=JsonStringAt(response,"followerId");

   if(token=="")
     {
      PrintFormat("VT Copier: pairing response missing token: %s",response);
      return false;
     }

   g_token=token;
   SaveToken();

   PrintFormat("VT Copier: paired successfully. followerId=%s",g_followerId);
   return true;
  }

//==================================================================
// HEARTBEAT / ACK
//==================================================================
void SendHeartbeat()
  {
   if(g_token=="")
      return;

   string body=StringFormat(
      "{\"mtLogin\":\"%I64u\",\"brokerServer\":\"%s\",\"eaVersion\":\"%s\"}",
      g_login,
      JsonEscape(AccountInfoString(ACCOUNT_SERVER)),
      JsonEscape(InpCopierVersion)
   );

   string response;
   int code;
   Http("POST","/api/copy/heartbeat",body,true,response,code);
  }

bool Ack(string executionId,string status,long ticket,double volume,
         double price,string errorCode,string errorMessage)
  {
   string body=StringFormat(
      "{\"executionId\":\"%s\",\"status\":\"%s\",\"followerTradeId\":\"%I64d\",\"executedVolume\":%.8f,\"executedPrice\":%.10f,\"errorCode\":\"%s\",\"errorMessage\":\"%s\"}",
      JsonEscape(executionId),
      JsonEscape(status),
      ticket,
      volume,
      price,
      JsonEscape(errorCode),
      JsonEscape(errorMessage)
   );

   string response;
   int code;
   return Http("POST","/api/copy/ack",body,true,response,code);
  }

//==================================================================
// LOCAL POSITION MAPPING
//==================================================================
string MasterComment(string masterTradeId)
  {
   return "VTCP|"+masterTradeId;
  }

long FindPosition(string masterTradeId)
  {
   string wanted=MasterComment(masterTradeId);

   for(int i=0;i<PositionsTotal();i++)
     {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;

      if(PositionGetString(POSITION_COMMENT)==wanted)
         return (long)ticket;
     }

   return -1;
  }

bool EnsureSymbol(string symbol)
  {
   if(symbol=="")
      return false;

   if(SymbolInfoInteger(symbol,SYMBOL_SELECT))
      return true;

   ResetLastError();
   if(!SymbolSelect(symbol,true))
     {
      PrintFormat("VT Copier: cannot select %s error=%d",
                  symbol,GetLastError());
      return false;
     }

   return true;
  }

double NormalizeVolume(string symbol,double volume)
  {
   if(volume<=0.0)
      return 0.0;

   double minLot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN);
   double maxLot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);

   if(step<=0.0)
      step=minLot;

   if(step<=0.0)
      return volume;

   volume=MathMax(minLot,MathMin(maxLot,volume));
   volume=MathFloor((volume+1e-12)/step)*step;

   int digits=0;
   double probe=step;
   while(digits<8 && MathAbs(probe-MathRound(probe))>1e-9)
     {
      probe*=10.0;
      digits++;
     }

   return NormalizeDouble(volume,digits);
  }

//==================================================================
// OPEN
//==================================================================
bool ExecuteOpen(string executionId,string masterTradeId,
                 string masterSymbol,string direction,
                 double requestedVolume,double stopLoss,
                 double takeProfit,string settingsJson)
  {
   if(!InpAllowTrading)
     {
      Ack(executionId,"failed",-1,0,0,
          "TRADING_DISABLED","Copier trading is disabled.");
      return false;
     }

   // Idempotency: if this master trade was already copied, ACK it
   // instead of opening a second position.
   long existing=FindPosition(masterTradeId);
   if(existing>0 && PositionSelectByTicket((ulong)existing))
     {
      Ack(executionId,"executed",existing,
          PositionGetDouble(POSITION_VOLUME),
          PositionGetDouble(POSITION_PRICE_OPEN),"","");
      return true;
     }

   string symbol=MapSymbol(masterSymbol,settingsJson);

   if(!EnsureSymbol(symbol))
     {
      Ack(executionId,"failed",-1,0,0,
          "SYMBOL_NOT_FOUND",symbol);
      return false;
     }

   double volume=NormalizeVolume(symbol,requestedVolume);

   if(volume<=0.0)
     {
      Ack(executionId,"failed",-1,0,0,
          "INVALID_VOLUME","Requested volume is invalid.");
      return false;
     }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);

   string comment=MasterComment(masterTradeId);
   bool ok=false;

   if(direction=="BUY")
      ok=trade.Buy(volume,symbol,0.0,stopLoss,takeProfit,comment);
   else if(direction=="SELL")
      ok=trade.Sell(volume,symbol,0.0,stopLoss,takeProfit,comment);
   else
     {
      Ack(executionId,"failed",-1,0,0,
          "INVALID_DIRECTION",direction);
      return false;
     }

   if(!ok)
     {
      string msg=trade.ResultRetcodeDescription();

      Ack(executionId,"failed",-1,0,0,
          (string)trade.ResultRetcode(),msg);

      PrintFormat("VT Copier: OPEN failed %s %s %.2f retcode=%u %s",
                  direction,symbol,volume,trade.ResultRetcode(),msg);
      return false;
     }

   long ticket=FindPosition(masterTradeId);
   double executedVolume=volume;
   double executedPrice=trade.ResultPrice();

   if(ticket>0 && PositionSelectByTicket((ulong)ticket))
     {
      executedVolume=PositionGetDouble(POSITION_VOLUME);
      executedPrice=PositionGetDouble(POSITION_PRICE_OPEN);
     }

   Ack(executionId,"executed",ticket,
       executedVolume,executedPrice,"","");

   PrintFormat("VT Copier: OPEN executed %s %s %.2f ticket=%I64d",
               direction,symbol,executedVolume,ticket);

   return true;
  }

//==================================================================
// MODIFY
//==================================================================
bool ExecuteModify(string executionId,string masterTradeId,
                   double stopLoss,double takeProfit)
  {
   long ticket=FindPosition(masterTradeId);

   if(ticket<0)
     {
      Ack(executionId,"failed",-1,0,0,
          "POSITION_NOT_FOUND","Copied position not found.");
      return false;
     }

   if(!PositionSelectByTicket((ulong)ticket))
     {
      Ack(executionId,"failed",-1,0,0,
          "POSITION_NOT_FOUND","Copied position cannot be selected.");
      return false;
     }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);

   if(!trade.PositionModify((ulong)ticket,stopLoss,takeProfit))
     {
      string msg=trade.ResultRetcodeDescription();

      Ack(executionId,"failed",ticket,
          PositionGetDouble(POSITION_VOLUME),
          PositionGetDouble(POSITION_PRICE_OPEN),
          (string)trade.ResultRetcode(),msg);
      return false;
     }

   Ack(executionId,"executed",ticket,
       PositionGetDouble(POSITION_VOLUME),
       PositionGetDouble(POSITION_PRICE_OPEN),"","");

   return true;
  }

//==================================================================
// CLOSE
//==================================================================
bool ExecuteClose(string executionId,string masterTradeId)
  {
   long ticket=FindPosition(masterTradeId);

   // Already closed is a successful idempotent result.
   if(ticket<0)
     {
      Ack(executionId,"executed",-1,0,0,"","");
      return true;
     }

   if(!PositionSelectByTicket((ulong)ticket))
     {
      Ack(executionId,"executed",-1,0,0,"","");
      return true;
     }

   double volume=PositionGetDouble(POSITION_VOLUME);

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);

   if(!trade.PositionClose((ulong)ticket,InpDeviationPoints))
     {
      string msg=trade.ResultRetcodeDescription();

      Ack(executionId,"failed",ticket,volume,
          PositionGetDouble(POSITION_PRICE_OPEN),
          (string)trade.ResultRetcode(),msg);
      return false;
     }

   Ack(executionId,"executed",ticket,volume,
       trade.ResultPrice(),"","");

   return true;
  }

//==================================================================
// COMMAND PARSING
//==================================================================
bool ProcessCommand(string json,string settingsJson)
  {
   string executionId=JsonStringAt(json,"id");
   string masterTradeId=JsonStringAt(json,"master_trade_id");
   string eventType=JsonStringAt(json,"event_type");
   string symbol=JsonStringAt(json,"symbol");
   string direction=JsonStringAt(json,"direction");

   double volume=JsonNumberAt(json,"requested_volume");
   double stopLoss=JsonNumberAt(json,"stop_loss");
   double takeProfit=JsonNumberAt(json,"take_profit");

   if(executionId=="")
      executionId=JsonStringAt(json,"command_id");

   if(executionId=="" || masterTradeId=="" || eventType=="")
      return false;

   if(eventType=="OPEN")
      return ExecuteOpen(executionId,masterTradeId,
                         symbol,direction,volume,
                         stopLoss,takeProfit,settingsJson);

   if(eventType=="MODIFY")
      return ExecuteModify(executionId,masterTradeId,
                           stopLoss,takeProfit);

   if(eventType=="CLOSE")
      return ExecuteClose(executionId,masterTradeId);

   Ack(executionId,"failed",-1,0,0,
       "UNSUPPORTED_EVENT",eventType);
   return false;
  }

void ProcessPollResponse(string response)
  {
   // Current API returns a JSON object containing:
   // commands:[...], settings:{...}
   // We process each command by locating command_id boundaries.
   string settingsJson=JsonStringAt(response,"settings");
   if(settingsJson=="")
      settingsJson=response;

   int search=0;

   for(int count=0;count<25;count++)
     {
      string marker="\"command_id\":\"";
      int p=StringFind(response,marker,search);
      if(p<0)
         break;

      int next=StringFind(response,marker,p+StringLen(marker));
      int end=(next<0 ? StringLen(response) : next);

      int start=p;
      while(start>0 && StringGetCharacter(response,start)!='{')
         start--;

      if(start<0 || start>=end)
         break;

      string command=StringSubstr(response,start,end-start);
      ProcessCommand(command,settingsJson);

      search=end;
     }
  }

//==================================================================
// POLL / STATUS
//==================================================================
void PollCommands()
  {
   if(g_token=="")
      return;

   string response;
   int code;

   if(!Http("GET","/api/copy/poll","",true,response,code))
     {
      if(code==401)
         Print("VT Copier: token rejected. Re-pair this MT5 account.");
      return;
     }

   ProcessPollResponse(response);
  }

void ShowStatus()
  {
   if(!InpShowStatus)
      return;

   if(TimeCurrent()-g_lastStatus<5)
      return;

   g_lastStatus=TimeCurrent();

   Comment(
      "VaultTrades Copier\n",
      "Status: ",(g_token!="" ? "CONNECTED" : "NOT PAIRED"),"\n",
      "Account: ",(string)g_login,"\n",
      "Server: ",AccountInfoString(ACCOUNT_SERVER),"\n",
      "Version: ",InpCopierVersion,"\n",
      "Trading: ",(InpAllowTrading ? "ENABLED" : "DISABLED")
   );
  }

//==================================================================
// MT5 EVENTS
//==================================================================
int OnInit()
  {
   g_baseUrl=CleanBaseUrl();
   g_login=(ulong)AccountInfoInteger(ACCOUNT_LOGIN);
   g_tokenFile="VaultTrades_Copier_"+(string)g_login+".token";

   if(g_baseUrl=="")
     {
      Print("VT Copier: configure InpApiBaseUrl.");
      return INIT_PARAMETERS_INCORRECT;
     }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpDeviationPoints);

   bool loaded=LoadToken();

   if(!loaded && InpApiToken!="")
     {
      g_token=InpApiToken;
      SaveToken();
      loaded=true;
     }

   if(!loaded && InpPairingCode!="")
      PairAccount();

   if(g_token=="")
     {
      Print("VT Copier: no active token. Generate a pairing code in VaultTrades Copy.");
      ShowStatus();
      return INIT_SUCCEEDED;
     }

   EventSetTimer(MathMax(1,InpPollSeconds));
   SendHeartbeat();
   g_lastHeartbeatTick=GetTickCount();

   PrintFormat("VT Copier initialized. Account=%I64u Server=%s",
               g_login,AccountInfoString(ACCOUNT_SERVER));

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

void OnTimer()
  {
   PollCommands();

   uint now=GetTickCount();
   if(now-g_lastHeartbeatTick >=
      (uint)MathMax(5,InpHeartbeatSeconds)*1000)
     {
      SendHeartbeat();
      g_lastHeartbeatTick=now;
     }

   ShowStatus();
  }

void OnTick()
  {
   ShowStatus();
  }
//+------------------------------------------------------------------+
