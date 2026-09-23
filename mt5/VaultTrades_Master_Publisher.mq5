//+------------------------------------------------------------------+
//| VaultTrades | Master Publisher | Native MT5                     |
//| Publishes actual executions from the proven Master EA            |
//| Does NOT place, modify, or close trades.                         |
//+------------------------------------------------------------------+
#property strict
#property version   "1.00"
#property description "VaultTrades Master Publisher"
#property description "Publishes executed MT5 trades to the VaultTrades Copy API."
#property description "Attach separately from the proven EMA20 strategy EA."

//==================================================================
// INPUTS
//==================================================================
input string InpApiBaseUrl            = "https://vaulttradesve.com";
input string InpMasterId              = "197e2437-ed62-4292-b0ed-3cb6ebcc624a";
input string InpMasterApiKey          = ""; // VAULTTRADES_MASTER_API_KEY
input ulong  InpStrategyMagic         = 20260922;
input string InpPublisherVersion      = "1.00";
input int    InpHttpTimeoutMs         = 5000;
input int    InpTimerSeconds          = 2;
input int    InpHeartbeatSeconds      = 30;
input bool   InpPublishModifications  = true;
input bool   InpPublishOnlyTracked    = true;
input int    InpMaxRetryBatch         = 10;
input string InpQueueFilePrefix       = "VaultTrades_MasterPublisher";

//==================================================================
// STATE
//==================================================================
struct PendingEvent
  {
   string eventId;
   string masterTradeId;
   string eventType;
   string symbol;
   string direction;
   double volume;
   double price;
   double stopLoss;
   double takeProfit;
   long   eventTimeMs;
   string payload;
  };

struct TrackedPosition
  {
   ulong  positionId;
   string symbol;
   string direction;
   double volume;
   double stopLoss;
   double takeProfit;
   long   updateTimeMs;
  };

PendingEvent     g_queue[];
TrackedPosition  g_positions[];
string           g_queueFile = "";
ulong            g_login = 0;
uint             g_lastHeartbeatTick = 0;

//==================================================================
// STRING / JSON
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

string QueueFileName()
  {
   return InpQueueFilePrefix+"_"+(string)g_login+".csv";
  }

//==================================================================
// QUEUE PERSISTENCE
//==================================================================
void SaveQueue()
  {
   int h=FileOpen(g_queueFile,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,'\t');
   if(h==INVALID_HANDLE)
     {
      PrintFormat("VT Publisher: cannot save queue. error=%d",GetLastError());
      return;
     }

   for(int i=0;i<ArraySize(g_queue);i++)
     {
      PendingEvent e=g_queue[i];
      FileWrite(h,
                e.eventId,
                e.masterTradeId,
                e.eventType,
                e.symbol,
                e.direction,
                DoubleToString(e.volume,8),
                DoubleToString(e.price,10),
                DoubleToString(e.stopLoss,10),
                DoubleToString(e.takeProfit,10),
                (string)e.eventTimeMs,
                e.payload);
     }
   FileFlush(h);
   FileClose(h);
  }

void LoadQueue()
  {
   ArrayResize(g_queue,0);

   int h=FileOpen(g_queueFile,FILE_READ|FILE_CSV|FILE_ANSI|FILE_COMMON,'\t');
   if(h==INVALID_HANDLE)
      return;

   while(!FileIsEnding(h))
     {
      string eventId=FileReadString(h);
      if(eventId=="")
         break;

      PendingEvent e;
      e.eventId       = eventId;
      e.masterTradeId = FileReadString(h);
      e.eventType     = FileReadString(h);
      e.symbol        = FileReadString(h);
      e.direction     = FileReadString(h);
      e.volume        = StringToDouble(FileReadString(h));
      e.price         = StringToDouble(FileReadString(h));
      e.stopLoss      = StringToDouble(FileReadString(h));
      e.takeProfit    = StringToDouble(FileReadString(h));
      e.eventTimeMs   = (long)StringToInteger(FileReadString(h));
      e.payload       = FileReadString(h);

      int n=ArraySize(g_queue);
      ArrayResize(g_queue,n+1);
      g_queue[n]=e;
     }

   FileClose(h);
   PrintFormat("VT Publisher: loaded %d queued event(s).",ArraySize(g_queue));
  }

void Enqueue(PendingEvent &e)
  {
   int n=ArraySize(g_queue);
   ArrayResize(g_queue,n+1);
   g_queue[n]=e;
   SaveQueue();
  }

void RemoveQueueAt(int index)
  {
   int n=ArraySize(g_queue);
   if(index<0 || index>=n)
      return;

   for(int i=index;i<n-1;i++)
      g_queue[i]=g_queue[i+1];

   ArrayResize(g_queue,n-1);
   SaveQueue();
  }

//==================================================================
// HTTP
//==================================================================
bool PostJson(string endpoint,string body,string &response,int &httpCode)
  {
   response="";
   httpCode=-1;

   string base=SafeUrl();
   if(base=="" || InpMasterApiKey=="")
     {
      Print("VT Publisher: API URL or Master API key is not configured.");
      return false;
     }

   string url=base+endpoint;
   string headers=
      "Content-Type: application/json\r\n"
      "Accept: application/json\r\n"
      "x-vaulttrades-master-key: "+InpMasterApiKey+"\r\n";

   char data[];
   char result[];
   string resultHeaders;

   int copied=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   int dataSize=copied;
   if(dataSize>0 && data[dataSize-1]==0)
      dataSize--;

   ResetLastError();
   // IMPORTANT: use the WebRequest overload whose third argument is
   // the HTTP headers string. The previous implementation passed the
   // headers through the cookie/referer overload, so
   // x-vaulttrades-master-key was never sent to VaultTrades.
   httpCode=WebRequest(
      "POST",
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
      PrintFormat("VT Publisher: WebRequest failed endpoint=%s error=%d",endpoint,GetLastError());
      return false;
     }

   response=CharArrayToString(result,0,-1,CP_UTF8);

   if(httpCode<200 || httpCode>=300)
     {
      PrintFormat("VT Publisher: HTTP %d endpoint=%s response=%s",
                  httpCode,endpoint,response);
      return false;
     }

   return true;
  }

//==================================================================
// EVENT SERIALIZATION
//==================================================================
string BuildEventJson(PendingEvent &e)
  {
   // Build the JSON explicitly rather than through StringFormat.
   // This prevents locale/format-specifier issues from corrupting the
   // request body before it reaches the VaultTrades JSON parser.
   string payload=e.payload;
   if(payload=="")
      payload="{}";

   string body="{";
   body += "\"masterId\":\""      + JsonEscape(InpMasterId)       + "\",";
   body += "\"masterTradeId\":\"" + JsonEscape(e.masterTradeId)  + "\",";
   body += "\"eventId\":\""       + JsonEscape(e.eventId)        + "\",";
   body += "\"eventType\":\""     + JsonEscape(e.eventType)      + "\",";
   body += "\"symbol\":\""        + JsonEscape(e.symbol)         + "\",";
   body += "\"direction\":\""     + JsonEscape(e.direction)      + "\",";
   body += "\"volume\":"           + DoubleToString(e.volume,8)   + ",";
   body += "\"price\":"            + DoubleToString(e.price,10)    + ",";
   body += "\"stopLoss\":"         + DoubleToString(e.stopLoss,10) + ",";
   body += "\"takeProfit\":"       + DoubleToString(e.takeProfit,10) + ",";
   body += "\"eventTimeMs\":"      + (string)e.eventTimeMs + ",";
   body += "\"payload\":"          + payload;
   body += "}";

   return body;
  }

bool SendEvent(PendingEvent &e)
  {
   string response;
   int code;
   bool ok=PostJson("/api/copy/master/events",BuildEventJson(e),response,code);

   if(ok)
      PrintFormat("VT Publisher: published %s %s %s volume=%.2f price=%.*f",
                  e.eventType,e.symbol,e.direction,e.volume,
                  (int)SymbolInfoInteger(e.symbol,SYMBOL_DIGITS),e.price);

   return ok;
  }

void PublishOrQueue(PendingEvent &e)
  {
   if(!SendEvent(e))
      Enqueue(e);
  }

void FlushQueue()
  {
   int sent=0;
   int i=0;

   while(i<ArraySize(g_queue) && sent<InpMaxRetryBatch)
     {
      if(SendEvent(g_queue[i]))
        {
         RemoveQueueAt(i);
         sent++;
        }
      else
         i++;
     }
  }

//==================================================================
// POSITION TRACKING
//==================================================================
int FindTracked(ulong positionId)
  {
   for(int i=0;i<ArraySize(g_positions);i++)
      if(g_positions[i].positionId==positionId)
         return i;
   return -1;
  }

void TrackPosition(ulong positionId,
                   string symbol,
                   string direction,
                   double volume,
                   double stopLoss,
                   double takeProfit,
                   long updateTimeMs)
  {
   int idx=FindTracked(positionId);

   if(idx<0)
     {
      int n=ArraySize(g_positions);
      ArrayResize(g_positions,n+1);
      idx=n;
     }

   g_positions[idx].positionId=positionId;
   g_positions[idx].symbol=symbol;
   g_positions[idx].direction=direction;
   g_positions[idx].volume=volume;
   g_positions[idx].stopLoss=stopLoss;
   g_positions[idx].takeProfit=takeProfit;
   g_positions[idx].updateTimeMs=updateTimeMs;
  }

void UntrackPosition(ulong positionId)
  {
   int idx=FindTracked(positionId);
   if(idx<0)
      return;

   int n=ArraySize(g_positions);
   for(int i=idx;i<n-1;i++)
      g_positions[i]=g_positions[i+1];

   ArrayResize(g_positions,n-1);
  }

void LoadCurrentStrategyPositions()
  {
   ArrayResize(g_positions,0);

   for(int i=0;i<PositionsTotal();i++)
     {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;

      string symbol=PositionGetString(POSITION_SYMBOL);
      ulong magic=(ulong)PositionGetInteger(POSITION_MAGIC);
      if(magic!=InpStrategyMagic)
         continue;

      ulong positionId=(ulong)PositionGetInteger(POSITION_IDENTIFIER);
      ENUM_POSITION_TYPE type=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

      TrackPosition(
         positionId,
         symbol,
         type==POSITION_TYPE_BUY ? "BUY" : "SELL",
         PositionGetDouble(POSITION_VOLUME),
         PositionGetDouble(POSITION_SL),
         PositionGetDouble(POSITION_TP),
         (long)PositionGetInteger(POSITION_TIME_UPDATE_MSC)
      );
     }

   PrintFormat("VT Publisher: tracking %d existing strategy position(s).",
               ArraySize(g_positions));
  }

//==================================================================
// BUILD AND QUEUE TRADE EVENTS
//==================================================================
PendingEvent MakeEvent(string eventId,
                       string masterTradeId,
                       string eventType,
                       string symbol,
                       string direction,
                       double volume,
                       double price,
                       double stopLoss,
                       double takeProfit,
                       long eventTimeMs,
                       string payload)
  {
   PendingEvent e;
   e.eventId=eventId;
   e.masterTradeId=masterTradeId;
   e.eventType=eventType;
   e.symbol=symbol;
   e.direction=direction;
   e.volume=volume;
   e.price=price;
   e.stopLoss=stopLoss;
   e.takeProfit=takeProfit;
   e.eventTimeMs=eventTimeMs;
   e.payload=payload;
   return e;
  }

void QueueDealEvent(ulong dealTicket)
  {
   if(!HistoryDealSelect(dealTicket))
     {
      PrintFormat("VT Publisher: HistoryDealSelect failed for deal #%I64u error=%d",
                  dealTicket,GetLastError());
      return;
     }

   string symbol=HistoryDealGetString(dealTicket,DEAL_SYMBOL);
   if(symbol=="")
      return;

   ENUM_DEAL_TYPE dealType=(ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket,DEAL_TYPE);
   if(dealType!=DEAL_TYPE_BUY && dealType!=DEAL_TYPE_SELL)
      return;

   ENUM_DEAL_ENTRY entry=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket,DEAL_ENTRY);
   long magic=HistoryDealGetInteger(dealTicket,DEAL_MAGIC);
   ulong positionId=(ulong)HistoryDealGetInteger(dealTicket,DEAL_POSITION_ID);

   // The proven EMA20 EA uses this magic number. Opening deals are
   // filtered directly by deal magic. Closing deals are also accepted
   // when their position identifier is already tracked by this publisher.
   int tracked=FindTracked(positionId);

   if(entry==DEAL_ENTRY_IN)
     {
      if((ulong)magic!=InpStrategyMagic)
         return;

      double volume=HistoryDealGetDouble(dealTicket,DEAL_VOLUME);
      double price=HistoryDealGetDouble(dealTicket,DEAL_PRICE);
      double sl=HistoryDealGetDouble(dealTicket,DEAL_SL);
      double tp=HistoryDealGetDouble(dealTicket,DEAL_TP);
      string direction=(dealType==DEAL_TYPE_BUY ? "BUY" : "SELL");
      long timeMs=HistoryDealGetInteger(dealTicket,DEAL_TIME_MSC);

      string payload=StringFormat(
         "{\"source\":\"VaultTrades EMA20 Pullback Morning Engine\",\"dealTicket\":\"%I64u\",\"orderTicket\":\"%I64u\",\"positionId\":\"%I64u\",\"magic\":\"%I64d\",\"reason\":\"%I64d\"}",
         dealTicket,
         (ulong)HistoryDealGetInteger(dealTicket,DEAL_ORDER),
         positionId,
         magic,
         HistoryDealGetInteger(dealTicket,DEAL_REASON)
      );

      PendingEvent e=MakeEvent(
         "VT-OPEN-"+(string)dealTicket,
         (string)positionId,
         "OPEN",
         symbol,
         direction,
         volume,
         price,
         sl,
         tp,
         timeMs,
         payload
      );

      TrackPosition(positionId,symbol,direction,volume,sl,tp,timeMs);
      PublishOrQueue(e);
      return;
     }

   if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY)
     {
      if(InpPublishOnlyTracked && tracked<0)
         return;

      string direction="";
      if(tracked>=0)
         direction=g_positions[tracked].direction;
      else
         direction=(dealType==DEAL_TYPE_SELL ? "BUY" : "SELL");

      double volume=HistoryDealGetDouble(dealTicket,DEAL_VOLUME);
      double price=HistoryDealGetDouble(dealTicket,DEAL_PRICE);
      double sl=HistoryDealGetDouble(dealTicket,DEAL_SL);
      double tp=HistoryDealGetDouble(dealTicket,DEAL_TP);
      long timeMs=HistoryDealGetInteger(dealTicket,DEAL_TIME_MSC);

      string payload=StringFormat(
         "{\"source\":\"VaultTrades EMA20 Pullback Morning Engine\",\"dealTicket\":\"%I64u\",\"orderTicket\":\"%I64u\",\"positionId\":\"%I64u\",\"reason\":\"%I64d\",\"profit\":%.8f}",
         dealTicket,
         (ulong)HistoryDealGetInteger(dealTicket,DEAL_ORDER),
         positionId,
         HistoryDealGetInteger(dealTicket,DEAL_REASON),
         HistoryDealGetDouble(dealTicket,DEAL_PROFIT)
      );

      PendingEvent e=MakeEvent(
         "VT-CLOSE-"+(string)dealTicket,
         (string)positionId,
         "CLOSE",
         symbol,
         direction,
         volume,
         price,
         sl,
         tp,
         timeMs,
         payload
      );

      PublishOrQueue(e);

      if(tracked>=0)
        {
         if(PositionSelect(symbol))
            TrackPosition(positionId,
                          symbol,
                          direction,
                          PositionGetDouble(POSITION_VOLUME),
                          PositionGetDouble(POSITION_SL),
                          PositionGetDouble(POSITION_TP),
                          timeMs);
         else
            UntrackPosition(positionId);
        }
      return;
     }

   if(entry==DEAL_ENTRY_INOUT)
     {
      // The proven EMA20 EA does not reverse while a position exists
      // (HasOurPosition prevents that). Do not invent a reversal event.
      PrintFormat("VT Publisher: ignored reversal deal #%I64u.",dealTicket);
     }
  }

//==================================================================
// POSITION MODIFICATION DETECTION
//==================================================================
void CheckPositionModifications()
  {
   if(!InpPublishModifications)
      return;

   for(int i=0;i<ArraySize(g_positions);i++)
     {
      ulong id=g_positions[i].positionId;

      bool found=false;
      for(int p=0;p<PositionsTotal();p++)
        {
         ulong ticket=PositionGetTicket(p);
         if(ticket==0)
            continue;

         ulong currentId=(ulong)PositionGetInteger(POSITION_IDENTIFIER);
         if(currentId!=id)
            continue;

         found=true;

         string symbol=PositionGetString(POSITION_SYMBOL);
         double volume=PositionGetDouble(POSITION_VOLUME);
         double sl=PositionGetDouble(POSITION_SL);
         double tp=PositionGetDouble(POSITION_TP);
         long updateMs=(long)PositionGetInteger(POSITION_TIME_UPDATE_MSC);

         bool changed=
            MathAbs(volume-g_positions[i].volume)>0.00000001 ||
            MathAbs(sl-g_positions[i].stopLoss)>0.00000001 ||
            MathAbs(tp-g_positions[i].takeProfit)>0.00000001;

         if(changed && updateMs!=g_positions[i].updateTimeMs)
           {
            string payload=StringFormat(
               "{\"source\":\"VaultTrades EMA20 Pullback Morning Engine\",\"positionId\":\"%I64u\",\"updateTimeMs\":%I64d}",
               id,updateMs
            );

            PendingEvent e=MakeEvent(
               "VT-MODIFY-"+(string)id+"-"+(string)updateMs,
               (string)id,
               "MODIFY",
               symbol,
               g_positions[i].direction,
               volume,
               PositionGetDouble(POSITION_PRICE_OPEN),
               sl,
               tp,
               updateMs,
               payload
            );

            PublishOrQueue(e);

            g_positions[i].volume=volume;
            g_positions[i].stopLoss=sl;
            g_positions[i].takeProfit=tp;
            g_positions[i].updateTimeMs=updateMs;
           }
         break;
        }

      if(!found)
         UntrackPosition(id);
     }
  }

//==================================================================
// MASTER HEARTBEAT
//==================================================================
void SendHeartbeat()
  {
   string body=StringFormat(
      "{\"masterId\":\"%s\",\"mtLogin\":\"%I64u\",\"brokerServer\":\"%s\",\"eaVersion\":\"%s\"}",
      JsonEscape(InpMasterId),
      g_login,
      JsonEscape(AccountInfoString(ACCOUNT_SERVER)),
      JsonEscape(InpPublisherVersion)
   );

   string response;
   int code;
   PostJson("/api/copy/master/heartbeat",body,response,code);
  }

//==================================================================
// EVENTS
//==================================================================
int OnInit()
  {
   if(InpApiBaseUrl=="" || InpMasterApiKey=="")
     {
      Print("VT Publisher: configure InpApiBaseUrl and InpMasterApiKey before running.");
      return INIT_PARAMETERS_INCORRECT;
     }

   g_login=(ulong)AccountInfoInteger(ACCOUNT_LOGIN);
   g_queueFile=QueueFileName();

   LoadQueue();
   LoadCurrentStrategyPositions();

   EventSetTimer(MathMax(1,InpTimerSeconds));
   SendHeartbeat();
   g_lastHeartbeatTick=GetTickCount();

   PrintFormat(
      "VT Publisher initialized. Account=%I64u Server=%s Magic=%I64u MasterId=%s",
      g_login,
      AccountInfoString(ACCOUNT_SERVER),
      InpStrategyMagic,
      InpMasterId
   );

   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   SaveQueue();
  }

void OnTimer()
  {
   FlushQueue();
   CheckPositionModifications();

   uint now=GetTickCount();
   if(now-g_lastHeartbeatTick >= (uint)MathMax(5,InpHeartbeatSeconds)*1000)
     {
      SendHeartbeat();
      g_lastHeartbeatTick=now;
     }
  }

void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
  {
   if(trans.type!=TRADE_TRANSACTION_DEAL_ADD)
      return;

   if(trans.deal==0)
      return;

   QueueDealEvent(trans.deal);
  }
//+------------------------------------------------------------------+
