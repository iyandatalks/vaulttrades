//+------------------------------------------------------------------+
//| VaultTrades | Customer Copier | Native MT5 Expert Advisor         |
//| Polls the VaultTrades Copy API and mirrors master trades to the   |
//| customer broker account.                                          |
//+------------------------------------------------------------------+
#property strict
#property version   "1.11"
#property description "VaultTrades Customer Copier"
#property description "Polls pending copy commands and executes OPEN/MODIFY/CLOSE"
#property description "trades in the follower broker account."

#include <Trade/Trade.mqh>

//==================================================================
// INPUTS
//==================================================================
input string InpApiBaseUrl         = "https://vaulttradesve.com"; // VaultTrades stable production domain
input string InpPairingCode        = "";        // Temporary pairing code from VaultTrades (10 hex chars)
input string InpCopierVersion      = "1.11";    // Copier EA version
input int    InpPollSeconds        = 2;         // Poll interval in seconds
input int    InpHeartbeatSeconds   = 30;        // Heartbeat interval in seconds
input int    InpHttpTimeoutMs      = 5000;      // WebRequest timeout ms
input ulong  InpMagicNumber        = 20260923;  // Dedicated Copier position magic
input int    InpDeviationPoints    = 50;        // Default slippage deviation in points
input bool   InpAllowTrading       = true;      // Live mode: allow executing broker trades
input bool   InpShowStatus         = true;      // Journal status messages

//==================================================================
// CONSTANTS
//==================================================================
#define PFX_TAG        "VTC|"                   // Position comment prefix tag
#define MAX_COMMANDS   25
#define TOKEN_HEX_LEN  64

//==================================================================
// STATE
//==================================================================
struct Command
  {
   string            executionId;
   string            commandId;
   string            eventId;
   double            requestedVolume;
   string            status;
   string            masterTradeId;
   string            eventType;
   string            symbol;
   string            direction;
   double            volume;
   double            price;
   double            stopLoss;
   double            takeProfit;
   string            eventTime;
  };

struct SettingsState
  {
   string            lotMode;
   double            lotValue;
   string            symbolMapRaw;
   int               maxSlippagePoints;
   bool              copyExistingPositions;
  };

Command          g_commands[];
SettingsState    g_settings;
string           g_mapKeys[];
string           g_mapVals[];

string           g_token = "";
bool             g_paired = false;
ulong            g_login = 0;
string           g_tokenFile = "";
string           g_mapFile = "";
int              g_tick = 0;
bool             g_busy = false;
string           g_licenseStatus = "INACTIVE";
string           g_accessUntil = "";
string           g_lastResponse = "NOT CONNECTED";
datetime         g_lastResponseTime = 0;
bool             g_pairingBlocked = false;

// Durable execution mapping (survives restart; duplicate protection)
string           g_mapExecId[];
string           g_mapCommandId[];
string           g_mapMasterTrade[];
string           g_mapEventType[];
ulong            g_mapPosition[];
int              g_mapState[];        // 0 = processing/failed, 1 = broker executed
double           g_mapExecVolume[];
double           g_mapExecPrice[];
string           g_mapErrorCode[];
string           g_mapErrorMessage[];

//==================================================================
// STRING / JSON HELPERS
//==================================================================
string JsonEscape(string value)
  {
   StringReplace(value,"\\","\\\\");
   StringReplace(value,"\"","\\\"");
   StringReplace(value,"\r","\\r");
   StringReplace(value,"\n","\\n");
   return value;
  }

string SafeUrl()
  {
   string base=InpApiBaseUrl;
   while(StringLen(base)>0 && StringGetCharacter(base,StringLen(base)-1)=='/')
      base=StringSubstr(base,0,StringLen(base)-1);
   return base;
  }

string TrimStr(string s)
  {
   int len=StringLen(s);
   int b=0;
   while(b<len)
     {
      int ch=StringGetCharacter(s,b);
      if(ch!=' ' && ch!='\t' && ch!='\r' && ch!='\n')
         break;
      b++;
     }
   int e=len;
   while(e>b)
     {
      int ch=StringGetCharacter(s,e-1);
      if(ch!=' ' && ch!='\t' && ch!='\r' && ch!='\n')
         break;
      e--;
     }
   if(e<=b)
      return "";
   return StringSubstr(s,b,e-b);
  }

// Pairing codes are 10 hex chars; normalize a-f to uppercase deterministically.
string ToUpperHex(string s)
  {
   StringReplace(s,"a","A");
   StringReplace(s,"b","B");
   StringReplace(s,"c","C");
   StringReplace(s,"d","D");
   StringReplace(s,"e","E");
   StringReplace(s,"f","F");
   return s;
  }

bool IsWsChar(string s,int i)
  {
   int ch=StringGetCharacter(s,i);
   return (ch==' ' || ch=='\t' || ch=='\r' || ch=='\n');
  }

// Position of the character right after '"key":' (skipping whitespace)
int JsonKeyPosition(string json,string key,int from)
  {
   int len=StringLen(json);
   string needle="\""+key+"\"";
   int f=from;
   while(f<len)
     {
      int pos=StringFind(json,needle,f);
      if(pos<0)
         return -1;
      int p=pos+StringLen(needle);
      while(p<len && IsWsChar(json,p))
         p++;
      if(p<len && StringGetCharacter(json,p)==':')
         return p+1;
      f=pos+1;
     }
   return -1;
  }

// Balanced container extraction: returns true and sets endExclusive when the
// container starting at 'start' (must be '{' or '[') is fully consumed.
bool ExtractContainer(string src,int start,int &endExclusive)
  {
   int depth=0;
   bool inStr=false;
   int len=StringLen(src);

   for(int i=start;i<len;i++)
     {
      int ch=StringGetCharacter(src,i);

      if(inStr)
        {
         if(ch=='"')
           {
            int bs=0;
            int j=i-1;
            while(j>=start && StringGetCharacter(src,j)=='\\')
              {
               bs++;
               j--;
              }
            if(MathMod(bs,2)==0)
               inStr=false;
           }
         continue;
        }

      if(ch=='"')
        {
         inStr=true;
         continue;
        }

      if(ch=='{' || ch=='[')
         depth++;
      else if(ch=='}' || ch==']')
        {
         depth--;
         if(depth==0)
           {
            endExclusive=i+1;
            return true;
           }
        }
     }

   return false;
  }

// Raw substring of an object or array value for 'key'
bool JsonObjectRaw(string json,string key,int from,string &raw)
  {
   int p=JsonKeyPosition(json,key,from);
   if(p<0)
      return false;

   int len=StringLen(json);
   while(p<len && IsWsChar(json,p))
      p++;
   if(p>=len)
      return false;

   int ch=StringGetCharacter(json,p);
   if(ch!='{' && ch!='[')
      return false;

   int end;
   if(!ExtractContainer(json,p,end))
      return false;

   raw=StringSubstr(json,p,end-p);
   return true;
  }

int FindUnescapedQuote(string s,int from)
  {
   int len=StringLen(s);
   for(int i=from;i<len;i++)
     {
      int ch=StringGetCharacter(s,i);
      if(ch!='"')
         continue;
      int bs=0;
      int j=i-1;
      while(j>=from && StringGetCharacter(s,j)=='\\')
        {
         bs++;
         j--;
        }
      if(MathMod(bs,2)==0)
         return i;
     }
   return -1;
  }

string UnescapeJson(string s)
  {
   StringReplace(s,"\\/","/");
   StringReplace(s,"\\\"","\"");
   StringReplace(s,"\\\\","\\");
   return s;
  }

// String value of 'key' ("" when missing)
string JsonStr(string json,string key,int from)
  {
   int p=JsonKeyPosition(json,key,from);
   if(p<0)
      return "";

   int len=StringLen(json);
   while(p<len && IsWsChar(json,p))
      p++;
   if(p>=len || StringGetCharacter(json,p)!='"')
      return "";

   int q0=p+1;
   int qe=FindUnescapedQuote(json,q0);
   if(qe<0)
      return "";

   return UnescapeJson(StringSubstr(json,q0,qe-q0));
  }

// Number value of 'key' (0.0 when missing/not numeric)
double JsonNum(string json,string key,int from)
  {
   int p=JsonKeyPosition(json,key,from);
   if(p<0)
      return 0.0;

   int len=StringLen(json);
   while(p<len && IsWsChar(json,p))
      p++;

   int i=p;
   while(i<len)
     {
      int ch=StringGetCharacter(json,i);
      if(ch==',' || ch=='}' || ch==']' || ch==' ' || ch=='\t' || ch=='\r' || ch=='\n')
         break;
      i++;
     }

   string num=StringSubstr(json,p,i-p);
   return StringToDouble(num);
  }

// Boolean value of 'key'
bool JsonBool(string json,string key,int from)
  {
   int p=JsonKeyPosition(json,key,from);
   if(p<0)
      return false;

   int len=StringLen(json);
   while(p<len && IsWsChar(json,p))
      p++;
   if(p>=len)
      return false;

   int ch=StringGetCharacter(json,p);
   return (ch=='t'); // true / false
  }

//==================================================================
// HTTP
//==================================================================
bool HttpJson(string method,string url,string extraHeaders,string body,string &response,int &httpCode)
  {
   response="";
   httpCode=-1;

   string headers="Content-Type: application/json\r\n";
   if(extraHeaders!="")
      headers+=extraHeaders;

   char data[];
   int copied=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   int dataSize=copied;
   if(dataSize>0 && data[dataSize-1]==0)
      dataSize--;

   ArrayResize(data,dataSize);

   char result[];
   string resultHeaders;

   ResetLastError();
   httpCode=WebRequest(
               method,
               url,
               headers,
               InpHttpTimeoutMs,
               data,
               result,
               resultHeaders
            );

   if(httpCode<0)
     {
      PrintFormat("VT Copier: WebRequest failed url=%s error=%d",url,GetLastError());
      return false;
     }

   response=CharArrayToString(result,0,-1,CP_UTF8);

   if(httpCode<200 || httpCode>=300)
     {
      PrintFormat("VT Copier: HTTP %d url=%s response=%s",httpCode,url,response);
      return false;
     }

   return true;
  }

string AuthHeaders()
  {
   return "x-vaulttrades-copy-token: "+g_token+"\r\n";
  }

//==================================================================
// TOKEN PERSISTENCE (customer never enters it again after pairing)
//==================================================================
void LoadToken()
  {
   g_token="";
   g_paired=false;

   int h=FileOpen(g_tokenFile,FILE_READ|FILE_TXT|FILE_COMMON);
   if(h==INVALID_HANDLE)
      return;

   string t=FileReadString(h);
   FileClose(h);

   t=TrimStr(t);
   if(StringLen(t)==TOKEN_HEX_LEN)
     {
      g_token=t;
      g_paired=true;
     }
  }

void ClearSavedToken()
  {
   if(g_tokenFile!="")
      FileDelete(g_tokenFile,FILE_COMMON);
   g_token="";
   g_paired=false;
  }

void DrawStatus()
  {
   if(!InpShowStatus)
      return;
   string until=(g_accessUntil=="" ? "—" : g_accessUntil);
   string last=g_lastResponse;
   if(g_lastResponseTime>0)
      last+=" @ "+TimeToString(g_lastResponseTime,TIME_DATE|TIME_SECONDS);
   Comment(
      "VaultTrades Copier\n",
      "MT5 Account: ",(string)g_login,"\n",
      "Broker Server: ",AccountInfoString(ACCOUNT_SERVER),"\n",
      "License: ",g_licenseStatus,"\n",
      "Access Until: ",until,"\n",
      "Latest Response: ",last
   );
  }

void SaveToken()
  {
   if(g_token=="")
      return;

   int h=FileOpen(g_tokenFile,FILE_WRITE|FILE_TXT|FILE_COMMON);
   if(h==INVALID_HANDLE)
     {
      PrintFormat("VT Copier: cannot save token. error=%d",GetLastError());
      return;
     }

   FileWriteString(h,g_token);
   FileClose(h);
  }

//==================================================================
// PAIRING
//==================================================================
bool TryPair()
  {
   if(g_token!="")
     {
      g_paired=true;
      return true;
     }

   string code=TrimStr(InpPairingCode);
   code=ToUpperHex(code);

   if(code=="")
     {
      Print("VT Copier: no saved token and no pairing code. Enter the 10-char pairing code in EA inputs.");
      g_licenseStatus="INACTIVE";
      g_lastResponse="PAIRING CODE REQUIRED";
      DrawStatus();
      return false;
     }

   if(g_pairingBlocked)
      return false;

   string body=StringFormat(
                  "{\"pairingCode\":\"%s\",\"mtLogin\":\"%I64u\",\"brokerServer\":\"%s\",\"eaVersion\":\"%s\"}",
                  JsonEscape(code),
                  g_login,
                  JsonEscape(AccountInfoString(ACCOUNT_SERVER)),
                  JsonEscape(InpCopierVersion)
               );

   string url=SafeUrl()+"/api/copy/pair/redeem";
   string response;
   int httpCode;

   bool ok=HttpJson("POST",url,"",body,response,httpCode);
   if(!ok)
     {
      g_lastResponse="PAIRING HTTP "+(string)httpCode;
      g_lastResponseTime=TimeCurrent();
      if(httpCode==409 || httpCode==401)
         g_pairingBlocked=true;
      DrawStatus();
      return false;
     }

   string token=TrimStr(JsonStr(response,"token",0));
   if(StringLen(token)!=TOKEN_HEX_LEN)
     {
      PrintFormat("VT Copier: pairing response missing token. response=%s",response);
      return false;
     }

   g_token=token;
   g_paired=true;
   g_pairingBlocked=false;
   g_licenseStatus="ACTIVE";
   g_accessUntil=JsonStr(response,"accessUntil",0);
   g_lastResponse="PAIRED";
   g_lastResponseTime=TimeCurrent();
   SaveToken();

   string followerId=JsonStr(response,"followerId",0);
   PrintFormat("VT Copier: paired with VaultTrades. followerId=%s token=%.12s...",
               followerId,g_token);

   DrawStatus();
   return true;
  }

//==================================================================
// HEARTBEAT
//==================================================================
void SendHeartbeat()
  {
   if(!g_paired)
      return;

   string body=StringFormat(
                  "{\"mtLogin\":\"%I64u\",\"brokerServer\":\"%s\",\"eaVersion\":\"%s\"}",
                  g_login,
                  JsonEscape(AccountInfoString(ACCOUNT_SERVER)),
                  JsonEscape(InpCopierVersion)
               );

   string url=SafeUrl()+"/api/copy/heartbeat";
   string response;
   int httpCode;

   HttpJson("POST",url,AuthHeaders(),body,response,httpCode);
  }

//==================================================================
// ACK
//==================================================================
bool AckCommand(string executionId,
                string status,
                string followerTradeId,
                double executedVolume,
                double executedPrice,
                string errorCode,
                string errorMessage)
  {
   if(!g_paired)
      return false;

   string body=StringFormat(
                  "{\"executionId\":\"%s\",\"status\":\"%s\",\"followerTradeId\":%s,\"executedVolume\":%s,\"executedPrice\":%s,\"errorCode\":%s,\"errorMessage\":%s}",
                  JsonEscape(executionId),
                  JsonEscape(status),
                  followerTradeId=="" ? "null" : "\""+JsonEscape(followerTradeId)+"\"",
                  executedVolume>0 ? DoubleToString(executedVolume,8) : "null",
                  executedPrice!=0 ? DoubleToString(executedPrice,8) : "null",
                  errorCode=="" ? "null" : "\""+JsonEscape(errorCode)+"\"",
                  errorMessage=="" ? "null" : "\""+JsonEscape(errorMessage)+"\""
               );

   string url=SafeUrl()+"/api/copy/ack";
   string response;
   int httpCode;

   bool ok=HttpJson("POST",url,AuthHeaders(),body,response,httpCode);
   if(ok && InpShowStatus)
      PrintFormat("VT Copier: ACK %s executionId=%s",status,executionId);

   return ok;
  }

//==================================================================
// DURABLE EXECUTION MAPPING
//==================================================================
int FindMappingExec(string executionId)
  {
   for(int i=0;i<ArraySize(g_mapExecId);i++)
      if(g_mapExecId[i]==executionId)
         return i;
   return -1;
  }

int FindMappingMaster(string masterTradeId,string eventType)
  {
   for(int i=0;i<ArraySize(g_mapMasterTrade);i++)
      if(g_mapMasterTrade[i]==masterTradeId && g_mapEventType[i]==eventType)
         return i;
   return -1;
  }

void AddMappingRow(string executionId,
                   string commandId,
                   string masterTradeId,
                   string eventType,
                   ulong position,
                   int state,
                   double execVolume,
                   double execPrice,
                   string errorCode,
                   string errorMessage)
  {
   int n=ArraySize(g_mapExecId);

   ArrayResize(g_mapExecId,n+1);
   ArrayResize(g_mapCommandId,n+1);
   ArrayResize(g_mapMasterTrade,n+1);
   ArrayResize(g_mapEventType,n+1);
   ArrayResize(g_mapPosition,n+1);
   ArrayResize(g_mapState,n+1);
   ArrayResize(g_mapExecVolume,n+1);
   ArrayResize(g_mapExecPrice,n+1);
   ArrayResize(g_mapErrorCode,n+1);
   ArrayResize(g_mapErrorMessage,n+1);

   g_mapExecId[n]=executionId;
   g_mapCommandId[n]=commandId;
   g_mapMasterTrade[n]=masterTradeId;
   g_mapEventType[n]=eventType;
   g_mapPosition[n]=position;
   g_mapState[n]=state;
   g_mapExecVolume[n]=execVolume;
   g_mapExecPrice[n]=execPrice;
   g_mapErrorCode[n]=errorCode;
   g_mapErrorMessage[n]=errorMessage;

   SaveMapping();
  }

void UpdateMappingRow(int idx,
                      ulong position,
                      int state,
                      double execVolume,
                      double execPrice,
                      string errorCode,
                      string errorMessage)
  {
   if(idx<0 || idx>=ArraySize(g_mapExecId))
      return;

   g_mapPosition[idx]=position;
   g_mapState[idx]=state;
   g_mapExecVolume[idx]=execVolume;
   g_mapExecPrice[idx]=execPrice;
   g_mapErrorCode[idx]=errorCode;
   g_mapErrorMessage[idx]=errorMessage;

   SaveMapping();
  }

void SaveMapping()
  {
   int h=FileOpen(g_mapFile,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,'\t');
   if(h==INVALID_HANDLE)
     {
      PrintFormat("VT Copier: cannot save mapping. error=%d",GetLastError());
      return;
     }

   for(int i=0;i<ArraySize(g_mapExecId);i++)
     {
      string errCode=g_mapErrorCode[i];
      string errMsg=g_mapErrorMessage[i];
      StringReplace(errCode,"\t"," ");
      StringReplace(errMsg,"\t"," ");

      FileWrite(h,
                g_mapExecId[i],
                g_mapCommandId[i],
                g_mapMasterTrade[i],
                g_mapEventType[i],
                (string)g_mapPosition[i],
                (string)g_mapState[i],
                DoubleToString(g_mapExecVolume[i],8),
                DoubleToString(g_mapExecPrice[i],8),
                errCode,
                errMsg);
     }

   FileFlush(h);
   FileClose(h);
  }

void LoadMapping()
  {
   ArrayResize(g_mapExecId,0);
   ArrayResize(g_mapCommandId,0);
   ArrayResize(g_mapMasterTrade,0);
   ArrayResize(g_mapEventType,0);
   ArrayResize(g_mapPosition,0);
   ArrayResize(g_mapState,0);
   ArrayResize(g_mapExecVolume,0);
   ArrayResize(g_mapExecPrice,0);
   ArrayResize(g_mapErrorCode,0);
   ArrayResize(g_mapErrorMessage,0);

   int h=FileOpen(g_mapFile,FILE_READ|FILE_CSV|FILE_ANSI|FILE_COMMON,'\t');
   if(h==INVALID_HANDLE)
      return;

   while(!FileIsEnding(h))
     {
      string executionId=FileReadString(h);
      if(executionId=="")
         break;

      int n=ArraySize(g_mapExecId);
      ArrayResize(g_mapExecId,n+1);
      ArrayResize(g_mapCommandId,n+1);
      ArrayResize(g_mapMasterTrade,n+1);
      ArrayResize(g_mapEventType,n+1);
      ArrayResize(g_mapPosition,n+1);
      ArrayResize(g_mapState,n+1);
      ArrayResize(g_mapExecVolume,n+1);
      ArrayResize(g_mapExecPrice,n+1);
      ArrayResize(g_mapErrorCode,n+1);
      ArrayResize(g_mapErrorMessage,n+1);

      g_mapExecId[n]=executionId;
      g_mapCommandId[n]=FileReadString(h);
      g_mapMasterTrade[n]=FileReadString(h);
      g_mapEventType[n]=FileReadString(h);
      g_mapPosition[n]=(ulong)StringToInteger(FileReadString(h));
      g_mapState[n]=(int)StringToInteger(FileReadString(h));
      g_mapExecVolume[n]=StringToDouble(FileReadString(h));
      g_mapExecPrice[n]=StringToDouble(FileReadString(h));
      g_mapErrorCode[n]=FileReadString(h);
      g_mapErrorMessage[n]=FileReadString(h);
     }

   FileClose(h);
   PrintFormat("VT Copier: loaded %d mapping row(s).",ArraySize(g_mapExecId));
  }

//==================================================================
// SYMBOL MAPPING
//==================================================================
void ParseSymbolMap()
  {
   ArrayResize(g_mapKeys,0);
   ArrayResize(g_mapVals,0);

   string raw=g_settings.symbolMapRaw;
   int len=StringLen(raw);
   int i=0;

   while(i<len)
     {
      int ch=StringGetCharacter(raw,i);
      if(ch=='"')
        {
         int k0=i+1;
         int ke=FindUnescapedQuote(raw,k0);
         if(ke<0)
            break;

         string key=UnescapeJson(StringSubstr(raw,k0,ke-k0));
         i=ke+1;

         while(i<len && IsWsChar(raw,i))
            i++;
         if(i>=len || StringGetCharacter(raw,i)!=':')
            continue;
         i++;
         while(i<len && IsWsChar(raw,i))
            i++;
         if(i>=len || StringGetCharacter(raw,i)!='"')
            continue;

         int v0=i+1;
         int ve=FindUnescapedQuote(raw,v0);
         if(ve<0)
            break;

         string val=UnescapeJson(StringSubstr(raw,v0,ve-v0));
         int n=ArraySize(g_mapKeys);
         ArrayResize(g_mapKeys,n+1);
         ArrayResize(g_mapVals,n+1);
         g_mapKeys[n]=key;
         g_mapVals[n]=val;

         i=ve+1;
        }
      else
         i++;
     }
  }

string ResolveSymbol(string masterSymbol)
  {
   for(int i=0;i<ArraySize(g_mapKeys);i++)
      if(g_mapKeys[i]==masterSymbol)
         return g_mapVals[i];
   return masterSymbol;
  }

bool SymbolAvailable(string symbol)
  {
   if(symbol=="")
      return false;

   long mode=SymbolInfoInteger(symbol,SYMBOL_TRADE_MODE);
   if(mode==0)
      return false;

   int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   if(digits==0)
      return false;

   return true;
  }

//==================================================================
// VOLUME NORMALIZATION
//==================================================================
double NormalizeVolume(double requested,string symbol,bool &ok,string &err)
  {
   ok=true;
   err="";

   double min=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN);
   double max=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);

   if(min<=0) min=0.01;
   if(max<=0) max=1000.0;
   if(step<=0) step=0.01;

   if(requested<=0)
     {
      ok=false;
      err="VOLUME_ZERO";
      return 0;
     }

   if(requested+1e-9 < min)
     {
      ok=false;
      err="VOLUME_BELOW_MIN";
      return 0;
     }

   double v=MathFloor(requested/step+1e-9)*step;
   v=NormalizeDouble(v,8);

   if(v+1e-9 < min)
      v=min;
   if(v-1e-9 > max)
     {
      ok=false;
      err="VOLUME_ABOVE_MAX";
      return 0;
     }
   if(v<=0)
     {
      ok=false;
      err="VOLUME_INVALID_STEP";
      return 0;
     }

   return v;
  }

//==================================================================
// SL / TP VALIDATION
//==================================================================
bool ValidateStops(string symbol,string direction,double &sl,double &tp,string &err,bool isModify)
  {
   int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   if(digits>0)
     {
      sl=NormalizeDouble(sl,digits);
      tp=NormalizeDouble(tp,digits);
     }

   if(sl<=0 && tp<=0)
      return true; // master event provided no stops

   double bid=SymbolInfoDouble(symbol,SYMBOL_BID);
   double ask=SymbolInfoDouble(symbol,SYMBOL_ASK);
   double point=SymbolInfoDouble(symbol,SYMBOL_POINT);
   if(bid<=0 || ask<=0 || point<=0)
     {
      err="MARKET_UNAVAILABLE";
      return false;
     }

   long stopsLevel=SymbolInfoInteger(symbol,SYMBOL_TRADE_STOPS_LEVEL);
   long freezeLevel=SymbolInfoInteger(symbol,SYMBOL_TRADE_FREEZE_LEVEL);

   double level=(double)stopsLevel;
   if(isModify && freezeLevel>level)
      level=(double)freezeLevel; // modification must respect the stricter freeze zone

   if(level>0)
     {
      double minD=level*point;

      if(direction=="BUY")
        {
         if(sl>0 && (sl>=bid || bid-sl<minD))
           {
            err="SL_TOO_CLOSE";
            return false;
           }
         if(tp>0 && (tp<=ask || tp-ask<minD))
           {
            err="TP_TOO_CLOSE";
            return false;
           }
        }
      else
        {
         if(sl>0 && (sl<=ask || sl-ask<minD))
           {
            err="SL_TOO_CLOSE";
            return false;
           }
         if(tp>0 && (tp>=bid || bid-tp<minD))
           {
            err="TP_TOO_CLOSE";
            return false;
           }
        }
     }

   return true;
  }

//==================================================================
// LIVE POSITION LOOKUP (comment tag + magic)
//==================================================================
// PositionGetTicket(i) selects the position at index i. Returning true when the
// ticket is found leaves that position selected. This is the ticket-based select
// for terminals whose PositionSelect(ulong) overload is unavailable.
bool SelectPositionByTicket(ulong ticket)
  {
   if(ticket==0)
      return false;

   for(int i=0;i<PositionsTotal();i++)
     {
      ulong t=PositionGetTicket(i);
      if(t==ticket)
         return true;
     }
   return false;
  }

ulong FindLiveCopiedPosition(string masterTradeId)
  {
   string tag=PFX_TAG+masterTradeId;

   for(int i=0;i<PositionsTotal();i++)
     {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;

      ulong magic=(ulong)PositionGetInteger(POSITION_MAGIC);
      if(magic!=InpMagicNumber)
         continue;

      string comment=PositionGetString(POSITION_COMMENT);
      if(comment==tag)
         return ticket;
     }

   return 0;
  }

//==================================================================
// RECONCILIATION AFTER RESTART
//==================================================================
void ReconcilePositions()
  {
   int updated=0;

   for(int i=0;i<PositionsTotal();i++)
     {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;

      ulong magic=(ulong)PositionGetInteger(POSITION_MAGIC);
      if(magic!=InpMagicNumber)
         continue;

      string comment=PositionGetString(POSITION_COMMENT);
      if(StringFind(comment,PFX_TAG,0)!=0)
         continue;

      string masterTradeId=StringSubstr(comment,StringLen(PFX_TAG));
      if(masterTradeId=="")
         continue;

      int idx=FindMappingMaster(masterTradeId,"OPEN");
      if(idx>=0 && g_mapPosition[idx]==0)
        {
         UpdateMappingRow(idx,ticket,1,
                          g_mapExecVolume[idx],
                          g_mapExecPrice[idx],
                          g_mapErrorCode[idx],
                          g_mapErrorMessage[idx]);
         updated++;
        }
     }

   if(updated>0 && InpShowStatus)
      PrintFormat("VT Copier: reconciled %d live copied position(s).",updated);
  }

//==================================================================
// COMMAND PARSING
//==================================================================
void ParseCommand(string chunk,Command &c)
  {
   c.executionId=JsonStr(chunk,"id",0);
   c.commandId=JsonStr(chunk,"command_id",0);
   c.eventId=JsonStr(chunk,"event_id",0);
   c.requestedVolume=JsonNum(chunk,"requested_volume",0);
   c.status=JsonStr(chunk,"status",0);

   string ev;
   if(JsonObjectRaw(chunk,"copy_trade_events",0,ev))
     {
      c.masterTradeId=JsonStr(ev,"master_trade_id",0);
      c.eventType=JsonStr(ev,"event_type",0);
      c.symbol=JsonStr(ev,"symbol",0);
      c.direction=JsonStr(ev,"direction",0);
      c.volume=JsonNum(ev,"volume",0);
      c.price=JsonNum(ev,"price",0);
      c.stopLoss=JsonNum(ev,"stop_loss",0);
      c.takeProfit=JsonNum(ev,"take_profit",0);
      c.eventTime=JsonStr(ev,"event_time",0);
     }
  }

void ParsePollResponse(string body)
  {
   ArrayResize(g_commands,0);

   string arr;
   if(JsonObjectRaw(body,"commands",0,arr) && StringGetCharacter(arr,0)=='[')
     {
      int len=StringLen(arr);
      int i=1;
      while(i<len)
        {
         if(StringGetCharacter(arr,i)=='{')
           {
            int end;
            if(ExtractContainer(arr,i,end))
              {
               Command c;
               ParseCommand(StringSubstr(arr,i,end-i),c);

               if(c.executionId!="")
                 {
                  int n=ArraySize(g_commands);
                  ArrayResize(g_commands,n+1);
                  g_commands[n]=c;
                 }

               i=end;
               continue;
              }
           }
         i++;
        }
     }

   // Settings
   string st;
   if(JsonObjectRaw(body,"settings",0,st))
     {
      g_settings.lotMode=JsonStr(st,"lotMode",0);
      g_settings.lotValue=JsonNum(st,"lotValue",0);
      g_settings.maxSlippagePoints=(int)JsonNum(st,"maxSlippagePoints",0);
      g_settings.copyExistingPositions=JsonBool(st,"copyExistingPositions",0);
      g_settings.symbolMapRaw="";
      JsonObjectRaw(st,"symbolMap",0,g_settings.symbolMapRaw);
      ParseSymbolMap();
     }
   else
     {
      // Defaults when settings absent
      g_settings.lotMode="fixed";
      g_settings.lotValue=0.01;
      g_settings.maxSlippagePoints=50;
      g_settings.copyExistingPositions=false;
      g_settings.symbolMapRaw="";
      ParseSymbolMap();
     }
  }

//==================================================================
// EXECUTION
//==================================================================
void AckFailed(Command &c,string errorCode,string errorMessage)
  {
   int idx=FindMappingExec(c.executionId);
   if(idx<0)
      AddMappingRow(c.executionId,c.commandId,c.masterTradeId,c.eventType,
                    0,0,0,0,errorCode,errorMessage);
   else
      UpdateMappingRow(idx,0,0,0,0,errorCode,errorMessage);

   AckCommand(c.executionId,"failed","",0,0,errorCode,errorMessage);
  }

void AckExecuted(Command &c,ulong position,double execVolume,double execPrice)
  {
   int idx=FindMappingExec(c.executionId);
   if(idx<0)
      AddMappingRow(c.executionId,c.commandId,c.masterTradeId,c.eventType,
                    position,1,execVolume,execPrice,"","");
   else
      UpdateMappingRow(idx,position,1,execVolume,execPrice,"","");

   AckCommand(c.executionId,"executed",
              position!=0 ? (string)position : "",
              execVolume,execPrice,"","");
  }

void ExecuteOpen(Command &c)
  {
   string tradedSymbol=ResolveSymbol(c.symbol);

   if(!SymbolAvailable(tradedSymbol))
     {
      AckFailed(c,"SYMBOL_UNAVAILABLE","symbol "+tradedSymbol+" not tradeable on follower");
      return;
     }

   // Duplicate protection: a copied position for this master trade already exists
   ulong existing=FindLiveCopiedPosition(c.masterTradeId);
   if(existing!=0)
     {
      if(InpShowStatus)
         PrintFormat("VT Copier: OPEN already copied position #%I64u for masterTradeId=%s; ACKing idempotently.",
                     existing,c.masterTradeId);
      AckExecuted(c,existing,
                  PositionGetDouble(POSITION_VOLUME),
                  PositionGetDouble(POSITION_PRICE_OPEN));
      return;
     }

   int knownIdx=FindMappingMaster(c.masterTradeId,"OPEN");
   if(knownIdx>=0 && g_mapState[knownIdx]==1 && g_mapPosition[knownIdx]!=0)
     {
      AckExecuted(c,g_mapPosition[knownIdx],
                  g_mapExecVolume[knownIdx],
                  g_mapExecPrice[knownIdx]);
      return;
     }

   if(c.masterTradeId=="")
     {
      AckFailed(c,"INVALID_EVENT","missing master_trade_id");
      return;
     }

   if(c.direction!="BUY" && c.direction!="SELL")
     {
      AckFailed(c,"INVALID_DIRECTION","direction must be BUY or SELL");
      return;
     }

   bool vok;
   string verr;
   double vol=NormalizeVolume(c.requestedVolume,tradedSymbol,vok,verr);
   if(!vok)
     {
      AckFailed(c,verr,"requested_volume="+DoubleToString(c.requestedVolume,8));
      return;
     }

   double sl=c.stopLoss;
   double tp=c.takeProfit;
   string serr;
   if(!ValidateStops(tradedSymbol,c.direction,sl,tp,serr,false))
     {
      AckFailed(c,serr,"master sl/tp rejected by broker rules");
      return;
     }

   if(InpShowStatus)
      PrintFormat("VT Copier: OPEN %s %s vol master=%.8f requested=%.8f -> %s=%.8f sl=%.5f tp=%.5f",
                  c.direction,c.symbol,c.volume,c.requestedVolume,
                  tradedSymbol,vol,sl,tp);

   ulong deviations=(ulong)InpDeviationPoints;
   if(g_settings.maxSlippagePoints>0)
      deviations=(ulong)g_settings.maxSlippagePoints;

   CTrade trade;
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(deviations);
   trade.SetTypeFillingBySymbol(tradedSymbol);

   string comment=PFX_TAG+c.masterTradeId;
   if(StringLen(comment)>31)
      comment=StringSubstr(comment,0,31);

   bool done=false;
   if(c.direction=="BUY")
      done=trade.Buy(vol,tradedSymbol,0.0,sl,tp,comment);
   else
      done=trade.Sell(vol,tradedSymbol,0.0,sl,tp,comment);

   uint retcode=trade.ResultRetcode();

   if(!done || retcode!=(uint)TRADE_RETCODE_DONE)
     {
      AckFailed(c,(string)retcode,trade.ResultComment());
      return;
     }

   // Obtain the actual position ticket by its durable tag
   ulong position=FindLiveCopiedPosition(c.masterTradeId);

   double execPrice=0;
   if(position!=0 && SelectPositionByTicket(position))
      execPrice=PositionGetDouble(POSITION_PRICE_OPEN);
   else
      execPrice=trade.ResultPrice();

   if(InpShowStatus)
      PrintFormat("VT Copier: OPEN executed position=#%I64u price=%.5f volume=%.8f",
                  position,execPrice,vol);

   AckExecuted(c,position,vol,execPrice);
  }

void ExecuteModify(Command &c)
  {
   string tradedSymbol=ResolveSymbol(c.symbol);

   ulong position=0;
   int idx=FindMappingMaster(c.masterTradeId,"OPEN");

   if(idx>=0 && g_mapPosition[idx]!=0)
      position=g_mapPosition[idx];

   if(position==0)
      position=FindLiveCopiedPosition(c.masterTradeId);

   if(position==0 || !SelectPositionByTicket(position))
     {
      AckFailed(c,"POSITION_NOT_FOUND","no copied position for masterTradeId "+c.masterTradeId);
      return;
     }

   ENUM_POSITION_TYPE ptype=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   string direction=ptype==POSITION_TYPE_BUY ? "BUY" : "SELL";

   double sl=c.stopLoss;
   double tp=c.takeProfit;
   string serr;
   if(!ValidateStops(tradedSymbol,direction,sl,tp,serr,true))
     {
      AckFailed(c,serr,"modify sl/tp rejected by broker rules");
      return;
     }

   ulong deviations=(ulong)InpDeviationPoints;
   if(g_settings.maxSlippagePoints>0)
      deviations=(ulong)g_settings.maxSlippagePoints;

   CTrade trade;
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(deviations);
   trade.SetTypeFillingBySymbol(tradedSymbol);

   bool done=trade.PositionModify(position,sl,tp);
   uint retcode=trade.ResultRetcode();

   if(!done || retcode!=(uint)TRADE_RETCODE_DONE)
     {
      AckFailed(c,(string)retcode,trade.ResultComment());
      return;
     }

   double execVolume=0;
   double execPrice=0;
   if(SelectPositionByTicket(position))
     {
      execVolume=PositionGetDouble(POSITION_VOLUME);
      execPrice=PositionGetDouble(POSITION_PRICE_OPEN);
     }

   AckExecuted(c,position,execVolume,execPrice);
  }

void ExecuteClose(Command &c)
  {
   ulong position=0;
   int idx=FindMappingMaster(c.masterTradeId,"OPEN");

   if(idx>=0 && g_mapPosition[idx]!=0)
      position=g_mapPosition[idx];

   if(position==0)
      position=FindLiveCopiedPosition(c.masterTradeId);

   if(position==0)
     {
      // Stored mapping proves the position was copied and already handled
      int mIdx=FindMappingExec(c.executionId);
      if(mIdx>=0 && g_mapState[mIdx]==1)
        {
         AckExecuted(c,0,g_mapExecVolume[mIdx],g_mapExecPrice[mIdx]);
         return;
        }

      AckFailed(c,"POSITION_NOT_FOUND","no copied position for masterTradeId "+c.masterTradeId);
      return;
     }

   if(!SelectPositionByTicket(position))
     {
      int mIdx=FindMappingExec(c.executionId);
      if(mIdx>=0 && g_mapState[mIdx]==1)
        {
         AckExecuted(c,0,g_mapExecVolume[mIdx],g_mapExecPrice[mIdx]);
         return;
        }

      AckFailed(c,"POSITION_NOT_FOUND","copied position already closed");
      return;
     }

   string tradedSymbol=PositionGetString(POSITION_SYMBOL);

   ulong deviations=(ulong)InpDeviationPoints;
   if(g_settings.maxSlippagePoints>0)
      deviations=(ulong)g_settings.maxSlippagePoints;

   CTrade trade;
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(deviations);
   trade.SetTypeFillingBySymbol(tradedSymbol);

   bool done=trade.PositionClose(position);
   uint retcode=trade.ResultRetcode();

   if(!done || retcode!=(uint)TRADE_RETCODE_DONE || SelectPositionByTicket(position))
     {
      AckFailed(c,(string)retcode,trade.ResultComment());
      return;
     }

   double execVolume=trade.ResultVolume();
   double execPrice=trade.ResultPrice();

   AckExecuted(c,0,execVolume,execPrice);
  }

void ProcessCommand(Command &c)
  {
   if(c.executionId=="")
      return;

   // Duplicate protection: never execute the same command twice
   int idx=FindMappingExec(c.executionId);
   if(idx>=0)
     {
      if(g_mapState[idx]==1)
        {
         // Execution already succeeded; retry the ACK (previous ACK may have failed)
         AckCommand(c.executionId,"executed",
                    g_mapPosition[idx]!=0 ? (string)g_mapPosition[idx] : "",
                    g_mapExecVolume[idx],
                    g_mapExecPrice[idx],
                    "","");
        }
      else
        {
         if(InpShowStatus)
            PrintFormat("VT Copier: execution %s already processed (not executed again).",
                        c.executionId);
        }
      return;
     }

   if(InpShowStatus)
      PrintFormat("VT Copier: received %s masterTradeId=%s symbol=%s vol=%.8f",
                  c.eventType,c.masterTradeId,c.symbol,c.requestedVolume);

   if(!InpAllowTrading)
     {
      // Observe mode: poll/display only, never place trades, never ACK executed
      PrintFormat("VT Copier: observe mode - skipping execution of %s",c.executionId);
      return;
     }

   if(c.eventType=="OPEN")
      ExecuteOpen(c);
   else if(c.eventType=="MODIFY")
      ExecuteModify(c);
   else if(c.eventType=="CLOSE")
      ExecuteClose(c);
   else
      AckFailed(c,"INVALID_EVENT_TYPE",c.eventType);
  }

//==================================================================
// POLL
//==================================================================
void PollAndProcess()
  {
   if(!g_paired)
      return;

   string url=SafeUrl()+"/api/copy/poll";
   string response;
   int httpCode;

   bool ok=HttpJson("GET",url,AuthHeaders(),"",response,httpCode);
   if(!ok)
     {
      if(httpCode==401)
        {
         g_licenseStatus="REVOKED";
         g_lastResponse="401 UNAUTHORIZED — CONNECTION REVOKED/REPLACED";
         ClearSavedToken();
         g_pairingBlocked=true;
        }
      else if(httpCode==403)
        {
         g_licenseStatus="EXPIRED";
         g_lastResponse="403 SUBSCRIPTION EXPIRED";
        }
      else
         g_lastResponse="POLL HTTP "+(string)httpCode;
      g_lastResponseTime=TimeCurrent();
      DrawStatus();
      return;
     }

   g_accessUntil=JsonStr(response,"accessUntil",0);
   string pollLicense=JsonStr(response,"licenseStatus",0);
   if(pollLicense!="") g_licenseStatus=pollLicense;
   g_lastResponse="POLL 200";
   g_lastResponseTime=TimeCurrent();

   ParsePollResponse(response);

   if(InpShowStatus && ArraySize(g_commands)>0)
      PrintFormat("VT Copier: poll returned %d command(s).",ArraySize(g_commands));

   for(int i=0;i<ArraySize(g_commands) && i<MAX_COMMANDS;i++)
     {
      Command c=g_commands[i];
      ProcessCommand(c);
     }
  }

//==================================================================
// EVENTS
//==================================================================
int OnInit()
  {
   if(InpApiBaseUrl=="")
     {
      Print("VT Copier: configure InpApiBaseUrl before running.");
      return INIT_PARAMETERS_INCORRECT;
     }

   g_login=(ulong)AccountInfoInteger(ACCOUNT_LOGIN);
   g_tokenFile="VaultTrades_Copier_"+(string)g_login+".token";
   g_mapFile="VaultTrades_Copier_"+(string)g_login+"_map.csv";

   LoadToken();
   LoadMapping();

   if(g_token!="" && InpShowStatus)
      PrintFormat("VT Copier: loaded saved token %.12s...",g_token);

   TryPair();

   if(g_paired)
      ReconcilePositions();

   DrawStatus();

   EventSetTimer(1);
   SendHeartbeat();

   PrintFormat(
      "VT Copier initialized. Account=%I64u Server=%s Magic=%I64u paired=%s live=%s",
      g_login,
      AccountInfoString(ACCOUNT_SERVER),
      InpMagicNumber,
      g_paired ? "true" : "false",
      InpAllowTrading ? "true" : "false"
   );

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   SaveMapping();
  }

void OnTimer()
  {
   if(g_busy)
      return;

   g_busy=true;
   g_tick++;

   if(!g_paired)
     {
      if(!g_pairingBlocked)
         TryPair();
      DrawStatus();
      g_busy=false;
      return;
     }

   if(MathMod(g_tick,MathMax(1,InpHeartbeatSeconds))==0)
      SendHeartbeat();

   if(MathMod(g_tick,MathMax(1,InpPollSeconds))==0)
      PollAndProcess();

   DrawStatus();
   g_busy=false;
  }
//+------------------------------------------------------------------+