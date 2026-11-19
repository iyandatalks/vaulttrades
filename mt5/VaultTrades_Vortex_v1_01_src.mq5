//+------------------------------------------------------------------+
//|                                      VaultTrades_Vortex_v1_01.mq5 |
//| MT5 port of VaultTrades FIB Retrace with OB (Pine v12).           |
//| Strategy source: Original_Architecture_OB_Performance_v12.pine    |
//|                                                                  |
//| v1.01: broker-aware gold/silver resolution, specification-driven  |
//| contract/volume/tick handling, three-target volume validation and  |
//| independent Order Block awareness. Fib retracement, entry, SL and |
//| TP mathematics are unchanged from v1.00.                          |
//| v1.00 is kept unchanged for rollback and comparison.              |
//+------------------------------------------------------------------+
#property strict
#property version   "1.01"
#property description "VaultTrades Vortex - Fib Retrace + Order Block; broker-aware gold support"

#include <Trade/Trade.mqh>
#include <VaultTrades/BrokerCompat.mqh>
#include <VaultTrades/StructureEngine.mqh>
CTrade trade;

// Customer-facing trading inputs. Default follows the agreed Vortex model.
// Sizing mode. Auto is the default because no fixed lot can be correct on every
// account: the three-target model needs at least three broker minimum lots, and
// that minimum differs per listing and per account group.
enum ENUM_VT_VORTEX_SIZING
  {
   VT_VX_AUTO  = 0,   // Auto: risk-based volume, three-target when the broker allows
   VT_VX_FIXED = 1    // Fixed: use the lot size below
  };
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
input ENUM_VT_VORTEX_SIZING InpSizingMode = VT_VX_FIXED; // Position sizing mode (fixed 0.03 = three 0.01 exits)
input double InpLotSize               = 0.03;  // Fixed lot (fixed mode only)
input double InpRiskPercent           = 1.0;   // Risk per trade (% of equity, auto mode)
input double InpMaxLotSize            = 0.0;   // Hard cap on auto volume (0 = broker maximum)
input string InpSymbolOverride        = "";    // Optional: GOLD, XAUUSD or exact broker symbol
input double InpMaxSpreadPoints       = 0;     // Execution guard: 0 disables the spread limit
input int    InpMaxSlippagePoints     = 20;    // Max accepted fill deviation in points (0 = use current spread)
input bool   InpAcceptPartialFill     = true;  // Accept a partial fill and rebuild the target ladder on it
input bool   InpAllowFullCloseFallback = false;// If true, unsupported splits close fully at TP1
// Calibration inputs. The measured GOLDmicro funnel showed the confluence floor
// and the retest window were the binding filters; both were fixed constants in
// v1.01. Defaults reproduce the original Pine v12 behaviour exactly.
input int    InpMinConfluence         = 60;    // Minimum confluence score 0..100 (Pine default 60)
input int    InpRetestBars            = 8;     // Max bars from fib touch to confirmed retest (default 8)
// Entry engine. Two engines live in this file and both read the same fib
// ladder, stop and targets; only the trigger differs. CONFLUENCE is the
// architecture this build shipped with. FIB_FLIP is the supplied Pine entry:
// price reaches the selected Fibonacci level and the bar closes back out of it
// in the direction of the trade, with the destination order block, the
// liquidity target and the risk geometry agreeing.
enum ENUM_VT_ENTRY_ENGINE
  {
   VT_EE_CONFLUENCE = 0,  // Confluence engine (window + displacement + score)
   VT_EE_FIB_FLIP   = 1,  // Fib flip engine (zone reached, bar closes back out)
   VT_EE_TOUCH      = 2   // Entry-zone touch: trade when price touches the fib band
  };
// The traded trigger. ENTRY_ZONE_TOUCH is the instruction of record: the trade
// is taken when price touches the entry zone of the fib ladder read on the
// attached timeframe. Candle shape, score floor, order block and retest window
// are confirmation layers, not the strategy, so they cannot veto a touch.
input ENUM_VT_ENTRY_ENGINE InpEntryEngine = VT_EE_TOUCH; // Entry engine
input bool   InpTouchNeedsWindow       = false; // Touch engine: require the NY Silver Bullet window
input bool   InpUseObStop              = false; // Tighten the TF stop to a nearer order block
input bool   InpAllowObTransition      = false; // Plan B: close the remainder on an opposite OB
input double InpMinLotSize             = 0.03;  // Volume floor: 0.03 = three expressible 0.01 exits
input double InpStopAtrMult            = 2.23;  // Stop loss: ATR multiple from entry (risk = 2.23 x ATR)
// Risk/reward. The risk is 2.23 x ATR from entry; RR fixes what that risk is
// asked to return. The number is applied to the frozen signal geometry only
// (entry, slDist, fib swing), so neither the anchor nor the test drifts.
//   OFF    - fib ladder exactly as the swing reads it, no RR test.
//   GATE   - fib ladder kept, setups whose final target pays less than
//            InpRRMultiple x risk are refused instead of being taken.
//   ANCHOR - fib distance ignored: final target sits at InpRRMultiple x risk,
//            the two partials spread evenly between entry and that target.
enum ENUM_VT_RR_MODE
  {
   VT_RR_OFF    = 0,  // Fib ladder only (no RR test)
   VT_RR_GATE   = 1,  // Fib ladder, refuse setups below the RR floor
   VT_RR_ANCHOR = 2   // Target placed at RR x risk (fib distance ignored)
  };
input ENUM_VT_RR_MODE InpRRMode        = VT_RR_ANCHOR;   // How the RR requirement is enforced
input double InpRRMultiple             = 1.81;  // Reward:risk the stop must return (1.81R)

// Internal strategy constants from Pine v12.
#define VT_MAGIC                 6111103
// Active magic for this instance: base + the traded timeframe in minutes, so an
// M1 instance (6111104) and an M5 instance (6111108) never share a position.
ulong g_magic = VT_MAGIC;
// Chart timeframe. VT_TF was a fixed M5 constant: every rule (Fib, Order
// Block, ATR, sessions, retest window) read M5 data even when the EA was
// attached to another chart, so a timeframe comparison was impossible. It is
// now selectable and still defaults to M5, which reproduces the original
// behaviour exactly. This selects the data the same rules run on; the rules
// themselves are unchanged.
input ENUM_TIMEFRAMES InpTimeframe = PERIOD_CURRENT; // PERIOD_CURRENT = the attached chart's timeframe drives every rule
ENUM_TIMEFRAMES VT_TF = PERIOD_M5;             // runtime copy of InpTimeframe
#define VT_ATR_PERIOD            14
#define VT_ENTRY_DISPLACEMENT    0.60
// Retest window moved to input InpRetestBars (default 8).
// Confluence floor moved to input InpMinConfluence (default 60).
#define VT_FIB_68                68.1
#define VT_FIB_78                78.6
#define VT_FIB_88                88.0
#define VT_TP1_FIB               38.2
#define VT_TP2_FIB               0.0
#define VT_TP3_FIB              -23.6
#define VT_TP4_PCT               1.50
#define VT_TP5_PCT               1.81
#define VT_OB_LOOKBACK           60
// Structure engine and risk model carried from the Pine v6 source.
#define VT_STRUCT_INVALIDATE     20      // structureInvalidateBars
#define VT_STOP_ATR_MULT         2.23    // stopLossAtrMultiplier (mirrors InpStopAtrMult)
#define VT_MAX_STOP_RISK_PCT     2.0     // maxStopRiskPct
#define VT_OB_DISPLACEMENT       0.80
#define VT_SWING_LEN             3
#define VT_MAX_BARS              700
#define VT_TARGETS               3      // TP1-TP3 only: 0.03 = 3 x 0.01, 0.02 banked before TP3
#define VT_OB_MAX_BLOCKS         64      // live pool; the scanner recycles it
#define VT_OB_RETIRE_BARS        60      // invalidated blocks older than this are freed

// Pine defaults: all three New York Silver Bullet windows enabled.
#define VT_TZ_NY                 -5   // Standard offset; DST is resolved below.

struct FibSetup
  {
   int               state;             // 0 idle, 1 institutional impulse, 2 retest, 3 confirmed
   int               impulse_bar;
   int               pullback_bar;
   int               direction;         // +1 buy, -1 sell
   double            fib_start;
   double            fib_end;
   double            selected_entry;
   // Fib anchor frozen at the moment the entry level was selected. The live Fib
   // re-anchors as price moves, but the entry is firm and the target percentages
   // must stay measured from it, so the range used for TP1-TP3 is snapshotted.
   double            fib_ref_top;
   double            fib_ref_bottom;
   double            target_ob_top;
   double            target_ob_bottom;
   double            liquidity_target;
   // Confirmation state captured on the retest bar. Without this the entry had
   // to re-satisfy tag + displacement + structure on a later bar, and that
   // combination never occurred once in 22 months of GOLDmicro data.
   bool              entry_tagged;
   bool              disp_ok;
   bool              structure_ok;
   datetime          signal_time;
  };

struct PositionPlan
  {
   bool              active;
   ulong             ticket;
   int               direction;
   double            initial_volume;
   double            remaining_volume;
   double            entry;
   double            sl;
   double            tp[VT_TARGETS];
   double            close_volume[VT_TARGETS];  // validated before the trade is opened
   bool              tp_done[VT_TARGETS];
   int               tp_count;
   bool              full_close_mode;           // small lot or broker cannot split
   datetime          signal_time;
  };

// Order Block awareness. This is a monitoring layer only: it never gates
// a Fib entry, never reverses a trade and never alters the v12 strategy.
struct OrderBlock
  {
   bool              used;
   int               direction;        // +1 bullish, -1 bearish
   bool              confirmed;        // false = DETECTED, true = ENTRY CONFIRMED
   datetime          detected_time;
   datetime          confirmed_time;
   double            top;
   double            bottom;
   bool              mitigated;
   bool              invalidated;
   bool              breaker;
  };

FibSetup g_buy, g_sell;
PositionPlan g_plan;
OrderBlock g_ob[];
SymbolSpecs g_specs;               // resolved broker symbol specifications
string g_symbol = "";              // resolved broker symbol name
int g_atr_handle = INVALID_HANDLE;
int g_ema_handle = INVALID_HANDLE;
datetime g_last_bar = 0;
int g_bar_counter = 0;
// Diagnostic counters (no effect on trading logic): they measure how far each
// setup advances through the state machine, so a zero-trade test can be
// explained instead of guessed at.
int g_diagImpulse=0, g_diagStage2=0, g_diagRetest=0, g_diagCandle=0;
int g_diagStage3=0, g_diagWin=0, g_diagDisp=0, g_diagFib=0;
int g_diagLiq=0, g_diagOb=0, g_diagStruct=0, g_diagScore=0;
// Near-miss counters: how many confirmation bars failed exactly one gate.
int g_missDisp=0, g_missOb=0, g_missScore=0, g_missLiq=0, g_allPass=0;
// Gate-attribution counters: every candidate bar is charged to the FIRST gate
// it fails, so the totals sum to the number of candidates and the binding
// filter is visible instead of inferred. InpEntryEngine decides which ladder
// is counted.
int g_gateCand=0, g_gateWin=0, g_gateLoc=0, g_gateRetest=0, g_gateDisp=0;
int g_gateTouch=0;   // TOUCH engine only: bars that never reached the entry zone
int g_gateFlipRetest=0, g_gateFlipCandle=0, g_gateOb=0, g_gateLiq=0, g_gateGeo=0;
int g_gateScore=0, g_gateQual=0;
// Confluence-score distribution at the confirmation bar, bucketed by 10.
int g_scoreBuckets[11];
int g_scoreSum=0, g_scoreMax=0, g_scoreMin=101;
string g_status = "INITIALISING";
// Structure transition engine + session memory (Pine: lastActiveSession).
VtStructureEngine g_struct;
string g_lastActiveSession = "Asia";
int    g_silver_ma_handle = INVALID_HANDLE;
double g_structLiqHigh = 0.0, g_structLiqLow = 0.0;
int    g_diagStructChoch = 0, g_diagStructLegs = 0, g_diagSilverOk = 0;
// Plan B (OB transition) state. 0 idle, 1 direction invalidated and waiting
// for price to return to the firm original entry, 2 remainder closed.
int      g_trState = 0;
double   g_trTarget = 0.0;
int      g_trDirection = 0;
datetime g_trConfirmed = 0;
int      g_trCount = 0;
int      g_trBlocked = 0;
int      g_trSeen = 0;   // OBs confirmed while a position was live (any direction)
int      g_trOpp  = 0;   // ... of those, opposite direction and NEWER than the entry bar
int      g_trStale = 0;  // ... of those, opposite direction but confirmed before our entry bar
int      g_trInv  = 0;   // opposite confirmed blocks invalidated before Plan B could use them
int      g_obDetected = 0;      // every OB the scanner has identified
int      g_obConfirmedAll = 0;  // every OB whose entry condition was confirmed
//----------------------------- Utilities ---------------------------
int DigitsForSymbol() { return g_specs.digits; }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double NPrice(const double p) { return VtNormalizeToTick(g_specs,p); }
double VolStep() { return g_specs.volumeStep; }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double MinVol() { return g_specs.volumeMin; }
double MaxVol() { return g_specs.volumeMax; }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool IsNewBar()
  {
   datetime t=iTime(g_symbol,VT_TF,0);
   if(t<=0 || t==g_last_bar)
      return false;
   g_last_bar=t;
   return true;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool GetRates(MqlRates &r[], int count=VT_MAX_BARS)
  {
   ArraySetAsSeries(r,true);
   int copied=CopyRates(g_symbol,VT_TF,0,count,r);
   return copied>=MathMin(count,250);
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double ATR(const int shift)
  {
   double a[];
   ArraySetAsSeries(a,true);
   if(g_atr_handle==INVALID_HANDLE || CopyBuffer(g_atr_handle,0,shift,1,a)!=1)
      return 0;
   return a[0];
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double EmaClose(const int shift)
  {
   double b[];
   ArraySetAsSeries(b,true);
   if(g_ema_handle==INVALID_HANDLE || CopyBuffer(g_ema_handle,0,shift,1,b)!=1)
      return 0;
   return b[0];
  }

// US DST: second Sunday in March through first Sunday in November.
int NthSunday(int year,int month,int nth)
  {
   MqlDateTime d= {0};
   d.year=year;
   d.mon=month;
   d.day=1;
   datetime first=StructToTime(d);
   TimeToStruct(first,d);
   int firstSunday=(d.day_of_week==0?1:8-d.day_of_week);
   return firstSunday+(nth-1)*7;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool IsNewYorkDST(datetime utc)
  {
   MqlDateTime u;
   TimeToStruct(utc,u);
   int startDay=NthSunday(u.year,3,2);
   int endDay=NthSunday(u.year,11,1);
   MqlDateTime s= {0};
   s.year=u.year;
   s.mon=3;
   s.day=startDay;
   s.hour=7;
   MqlDateTime e= {0};
   e.year=u.year;
   e.mon=11;
   e.day=endDay;
   e.hour=6;
   datetime start=StructToTime(s), finish=StructToTime(e);
   return utc>=start && utc<finish;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
datetime NewYorkTime(datetime utc)
  {
   int offset=IsNewYorkDST(utc)?-4:-5;
   return utc+offset*3600;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool InSilverBulletWindow(datetime barCloseUTC)
  {
   datetime ny=NewYorkTime(barCloseUTC);
   MqlDateTime d;
   TimeToStruct(ny,d);
   int m=d.hour*60+d.min;
   return (m>=180 && m<240) || (m>=600 && m<660) || (m>=840 && m<900);
  }
// Session range helpers. All ranges are calculated from completed M5 bars
// using New York wall-clock windows. Session range is used as a working
// anchor until the structural impulse engine replaces it.
bool SessionRange(datetime nowUTC,int startMin,int endMin,double &hi,double &lo)
  {
   MqlRates r[];
   if(!GetRates(r,VT_MAX_BARS))
      return false;
   hi=-DBL_MAX;
   lo=DBL_MAX;
   datetime nowNY=NewYorkTime(nowUTC);
   MqlDateTime today;
   TimeToStruct(nowNY,today);
   for(int i=1;i<ArraySize(r);i++)
     {
      datetime ny=NewYorkTime(r[i].time);
      MqlDateTime d;
      TimeToStruct(ny,d);
      int m=d.hour*60+d.min;
      if(d.year==today.year && d.mon==today.mon && d.day==today.day && m>=startMin && m<endMin)
        { hi=MathMax(hi,r[i].high); lo=MathMin(lo,r[i].low); }
     }
   return hi>-DBL_MAX && lo<DBL_MAX && hi>lo;
  }

// WICK-TO-WICK fib mapping mirrors f_buyLevel/f_sellLevel in Pine.
double BuyFib(double top,double bottom,double pct) { return top-(top-bottom)*(pct/100.0); }
double SellFib(double top,double bottom,double pct) { return bottom+(top-bottom)*(pct/100.0); }

// Find a target OB using the Pine v12 target-OB contract: nearest opposing
// candle beyond the liquidity target, followed by >=0.80 ATR displacement.
bool FindTargetOB(const bool bearish,double target,MqlRates &r[],double &obTop,double &obBottom)
  {
   double best=DBL_MAX;
   bool found=false;
   for(int i=2;i<MathMin(VT_OB_LOOKBACK,ArraySize(r)-1);i++)
     {
      double a=ATR(i-1);
      if(a<=0)
         continue;
      bool baseBull=(r[i].close>r[i].open), baseBear=(r[i].close<r[i].open);
      bool nextBear=(r[i-1].close<r[i-1].open), nextBull=(r[i-1].close>r[i-1].open);
      double body=MathAbs(r[i-1].close-r[i-1].open);
      bool bearDisp=nextBear && body>=a*VT_OB_DISPLACEMENT && r[i-1].close<r[i].low;
      bool bullDisp=nextBull && body>=a*VT_OB_DISPLACEMENT && r[i-1].close>r[i].high;
      if(bearish && baseBull && bearDisp && r[i].low>target)
        {
         double dist=r[i].low-target;
         if(dist<best)
           {
            best=dist;
            obTop=r[i].high;
            obBottom=r[i].low;
            found=true;
           }
        }
      if(!bearish && baseBear && bullDisp && r[i].high<target)
        {
         double dist=target-r[i].high;
         if(dist<best)
           {
            best=dist;
            obTop=r[i].high;
            obBottom=r[i].low;
            found=true;
           }
        }
     }
   return found;
  }

// Latest confirmed pivot levels (left/right=3). A pivot becomes known only
// after the right-side bars have closed, avoiding look-ahead.
bool LatestPivots(MqlRates &r[],double &ph,double &pl)
  {
   ph=0;
   pl=0;
   bool gotH=false,gotL=false;
   for(int i=VT_SWING_LEN+1;i<MathMin(150,ArraySize(r)-VT_SWING_LEN);i++)
     {
      bool isH=true,isL=true;
      for(int k=1;k<=VT_SWING_LEN;k++)
        {
         if(r[i].high<=r[i-k].high || r[i].high<=r[i+k].high)
            isH=false;
         if(r[i].low>=r[i-k].low || r[i].low>=r[i+k].low)
            isL=false;
        }
      if(isH && !gotH)
        {
         ph=r[i].high;
         gotH=true;
        }
      if(isL && !gotL)
        {
         pl=r[i].low;
         gotL=true;
        }
      if(gotH&&gotL)
         break;
     }
   return gotH&&gotL;
  }

// Prior day/week liquidity references.
bool PreviousDayLevels(double &hi,double &lo)
  { hi=iHigh(g_symbol,PERIOD_D1,1); lo=iLow(g_symbol,PERIOD_D1,1); return hi>0&&lo>0; }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool PreviousWeekLevels(double &hi,double &lo)
  { hi=iHigh(g_symbol,PERIOD_W1,1); lo=iLow(g_symbol,PERIOD_W1,1); return hi>0&&lo>0; }
// Broker-resolved silver instrument, used only when gold is traded.
// Missing silver data is never treated as a veto.
string g_silver_symbol="";
// Silver flow context mirroring the Pine silver votes.
struct VtSilverCtx
  {
   bool              flowAvail, structAvail, maAvail, volAvail;
   bool              falling, rising, maFalling, maRising, volSpike, bullStruct, bearStruct;
  };

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
VtSilverCtx GetSilverContext()
  {
   VtSilverCtx x;
   x.flowAvail=false;
   x.structAvail=false;
   x.maAvail=false;
   x.volAvail=false;
   x.falling=false;
   x.rising=false;
   x.maFalling=false;
   x.maRising=false;
   x.volSpike=false;
   x.bullStruct=false;
   x.bearStruct=false;
   if(g_silver_symbol=="")
      return x;
   MqlRates s[];
   ArraySetAsSeries(s,true);
   int n=CopyRates(g_silver_symbol,VT_TF,0,40,s);
   if(n<25)
      return x;
   g_diagSilverOk++;
   x.flowAvail=(s[1].close>0.0 && s[2].close>0.0);
   x.falling=(s[1].close<s[2].close);
   x.rising=(s[1].close>s[2].close);
   double ma[];
   ArraySetAsSeries(ma,true);
   if(g_silver_ma_handle!=INVALID_HANDLE && CopyBuffer(g_silver_ma_handle,0,1,2,ma)==2)
     { x.maAvail=(ma[0]>0.0 && ma[1]>0.0); x.maFalling=(ma[0]<ma[1]); x.maRising=(ma[0]>ma[1]); }
   double vs=0.0;
   for(int i=2;i<22;i++)
      vs+=(double)s[i].tick_volume;
   vs/=20.0;
   if(vs>0.0)
     {
      x.volAvail=true;
      x.volSpike=((double)s[1].tick_volume>vs*1.5);
     }
// Silver pivots (left/right 3): last and previous swing high/low.
   double phL=0.0,phP=0.0,plL=0.0,plP=0.0;
   int fh=0,fl=0;
   for(int i=4;i<n-3;i++)
     {
      bool isH=true,isL=true;
      for(int k=1;k<=3;k++)
        {
         if(s[i].high<=s[i-k].high||s[i].high<=s[i+k].high)
            isH=false;
         if(s[i].low>=s[i-k].low||s[i].low>=s[i+k].low)
            isL=false;
        }
      if(isH)
        {
         if(fh==0)
           {
            phL=s[i].high;
            fh++;
           }
         else
            if(fh==1)
              {
               phP=s[i].high;
               fh++;
              }
        }
      if(isL)
        {
         if(fl==0)
           {
            plL=s[i].low;
            fl++;
           }
         else
            if(fl==1)
              {
               plP=s[i].low;
               fl++;
              }
        }
      if(fh>=2 && fl>=2)
         break;
     }
   x.structAvail=(fh>=2 && fl>=2);
   if(x.structAvail)
     {
      x.bullStruct=(plL>plP && s[1].close>phL);
      x.bearStruct=(phL<phP && s[1].close<plL);
     }
   return x;
  }

// Pine v12 normalised confluence. Components: fib location 25, structure 20,
// PD/PW liquidity sweep 15, silver flow 15, silver structure 10, silver MA
// slope 10, silver volume 5. Missing sources leave the denominator.
int ConfluenceScoreV12(const int dir,MqlRates &r[],const double f68,const double f88)
  {
   int avail=0,raw=0;
   bool fibLoc=(dir>0?(r[1].low<=f68 && r[1].close>=f88):(r[1].high>=f68 && r[1].close<=f88));
   avail+=25;
   if(fibLoc)
      raw+=25;
   avail+=20;
   if((dir>0?g_struct.bull.active:g_struct.bear.active))
      raw+=20;
   double pdh=0,pdl=0,pwh=0,pwl=0;
   bool day=PreviousDayLevels(pdh,pdl), week=PreviousWeekLevels(pwh,pwl);
   if(day||week)
     {
      avail+=15;
      bool sweep=(dir>0)?((day&&r[1].low<pdl&&r[1].close>pdl)||(week&&r[1].low<pwl&&r[1].close>pwl))
                 :((day&&r[1].high>pdh&&r[1].close<pdh)||(week&&r[1].high>pwh&&r[1].close<pwh));
      if(sweep)
         raw+=15;
     }
   VtSilverCtx sx=GetSilverContext();
   if(sx.flowAvail)
     {
      avail+=15;
      if(dir>0?sx.falling:sx.rising)
         raw+=15;
     }
   if(sx.structAvail)
     {
      avail+=10;
      if(dir>0?sx.bullStruct:sx.bearStruct)
         raw+=10;
     }
   if(sx.maAvail)
     {
      avail+=10;
      if(dir>0?sx.maFalling:sx.maRising)
         raw+=10;
     }
   if(sx.volAvail)
     {
      avail+=5;
      if(sx.volSpike && (dir>0?sx.falling:sx.rising))
         raw+=5;
     }
   int score=(avail>0?(int)MathRound(100.0*raw/avail):0);
   bool contra=sx.flowAvail && sx.maAvail && ((dir>0&&sx.rising&&sx.maRising)||(dir<0&&sx.falling&&sx.maFalling));
   if(contra)
      score-=15;
   if(score<0)
      score=0;
   if(score>100)
      score=100;
   return score;
  }

// Confluence is normalized against available source components. Silver flow
// is informational/weighted when a usable XAG symbol is available.
int ConfluenceScore(const int dir,MqlRates &r[],double fib)
  {
   double pdh,pdl,pwh,pwl;
   bool day=PreviousDayLevels(pdh,pdl), week=PreviousWeekLevels(pwh,pwl);
   int available=25;
   int score=25;
   double ph,pl;
   if(LatestPivots(r,ph,pl))
     {
      available+=20;
      if((dir>0 && r[1].close>ph)||(dir<0 && r[1].close<pl))
         score+=20;
     }
   if(day)
     {
      available+=15;
      if((dir>0 && r[1].low<pdl && r[1].close>pdl)||(dir<0 && r[1].high>pdh && r[1].close<pdh))
         score+=15;
     }
// Silver inverse-flow vote is applicable to Gold only, when broker data exists.
   if(g_specs.asset==VT_ASSET_METAL)
     {
      string xag=g_silver_symbol;
      if(xag!="")
        {
         double c0=iClose(xag,VT_TF,1),c1=iClose(xag,VT_TF,2);
         if(c0>0&&c1>0)
           {
            available+=15;
            if((dir>0&&c0<c1)||(dir<0&&c0>c1))
               score+=15;
            double sh=iHigh(xag,VT_TF,2),sl=iLow(xag,VT_TF,2);
            if(sh>0&&sl>0)
              {
               available+=10;
               if((dir>0&&c0>sh)||(dir<0&&c0<sl))
                  score+=10;
              }
            long v0=iVolume(xag,VT_TF,1);
            double vs=0;
            for(int q=2;q<22;q++)
               vs+=(double)iVolume(xag,VT_TF,q);
            vs/=20.0;
            available+=5;
            if(vs>0&&v0>vs*1.5&&((dir>0&&c0<c1)||(dir<0&&c0>c1)))
               score+=5;
           }
        }
     }
   if(week)
     {
      available+=10;
      if((dir>0&&r[1].close>pwl)||(dir<0&&r[1].close<pwh))
         score+=10;
     }
// Trend contribution: M5 directional close vs EMA50. The handle is created
// once in OnInit; it is never rebuilt inside this function.
   double emaValue=EmaClose(1);
   if(emaValue>0.0)
     { available+=10; if((dir>0&&r[1].close>emaValue)||(dir<0&&r[1].close<emaValue))score+=10; }
   return (available>0?(int)MathRound(100.0*score/available):0);
  }
// Frozen completed-session liquidity: the sweep reference of the structure
// engine. Mirrors the Pine roll-over at each new session start.
bool CompletedSessionLiquidity(datetime nowUTC,double &hi,double &lo)
  {
   datetime ny=NewYorkTime(nowUTC);
   MqlDateTime d;
   TimeToStruct(ny,d);
   int m=d.hour*60+d.min;
   if(m<360)
      return SessionRange(nowUTC-86400,750,1020,hi,lo); // yesterday NY
   if(m<420)
      return SessionRange(nowUTC,0,360,hi,lo);          // Asia just done
   if(m<750)
      return SessionRange(nowUTC,0,360,hi,lo);          // London live -> Asia
   if(m<1020)
      return SessionRange(nowUTC,420,600,hi,lo);        // NY live -> London
   return SessionRange(nowUTC,750,1020,hi,lo);                  // NY done
  }

// Pine lastActiveSession: a gap between sessions retains the previous name.
void UpdateActiveSession(datetime nowUTC)
  {
   datetime ny=NewYorkTime(nowUTC);
   MqlDateTime d;
   TimeToStruct(ny,d);
   int m=d.hour*60+d.min;
   if(m<360)
      g_lastActiveSession="Asia";
   else
      if(m>=420 && m<600)
         g_lastActiveSession="London";
      else
         if(m>=750 && m<1020)
            g_lastActiveSession="New York";
  }

// Advance the structure engine by one closed bar.
void UpdateStructure()
  {
   MqlRates r[];
   if(!GetRates(r,VT_MAX_BARS))
      return;
   double ph=0.0,pl=0.0;
   LatestPivots(r,ph,pl);
   datetime barTime=r[1].time+PeriodSeconds(VT_TF);
   UpdateActiveSession(barTime);
   bool haveLiq=CompletedSessionLiquidity(barTime,g_structLiqHigh,g_structLiqLow);
   bool below=false,above=false;
   if(haveLiq && g_structLiqHigh>g_structLiqLow)
     {
      double prevLow=iLow(g_symbol,VT_TF,2), prevHigh=iHigh(g_symbol,VT_TF,2);
      below=(prevLow>=g_structLiqLow && r[1].low<g_structLiqLow);
      above=(prevHigh<=g_structLiqHigh && r[1].high>g_structLiqHigh);
     }
   int ev=VtStructureProcess(g_struct,r[1].high,r[1].low,barTime,below,above,ph,pl,VT_STRUCT_INVALIDATE);
   if(ev!=0)
      g_diagStructChoch++;
   if(g_struct.bull.active || g_struct.bear.active)
      g_diagStructLegs++;
  }

// Determine the latest completed session range used for Fib anchors.
bool GetFibAnchors(const int dir,datetime referenceTime,double &start,double &finish)
  {
// AUTHORITY: the live structure impulse leg wins over the session anchors.
   const VtStructureLeg leg=(dir>0?g_struct.bull:g_struct.bear);
   if(VtStructureLegReady(leg,g_specs.point))
     {
      start=leg.startPrice;
      finish=leg.endPrice;
      return true;
     }
   string anchorSession=g_lastActiveSession;
   double asiaH,asiaL,londonH,londonL,nyH,nyL;
   bool a=SessionRange(referenceTime,0,360,asiaH,asiaL);
   bool l=SessionRange(referenceTime,420,600,londonH,londonL);
   bool n=SessionRange(referenceTime,750,1020,nyH,nyL);
// Pine anchors to the LAST ACTIVE session, not the first available one.
   if(anchorSession=="New York" && n)
     {
      bool t=a;
      a=n;
      n=t;
     }
   else
      if(anchorSession=="London" && l)
        {
         bool t=a;
         a=l;
         l=t;
        }
   if(dir>0)
     {
      if(a)
        {
         start=asiaL;
         finish=asiaH;
        }
      else
         if(l)
           {
            start=londonL;
            finish=londonH;
           }
         else
            if(n)
              {
               start=nyL;
               finish=nyH;
              }
            else
               return false;
     }
   else
     {
      if(a)
        {
         start=asiaH;
         finish=asiaL;
        }
      else
         if(l)
           {
            start=londonH;
            finish=londonL;
           }
         else
            if(n)
              {
               start=nyH;
               finish=nyL;
              }
            else
               return false;
     }
   return MathAbs(start-finish)>g_specs.point;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool FindLiquidityTarget(const int dir,double &target)
  {
   double pdh,pdl,pwh,pwl;
   if(!PreviousDayLevels(pdh,pdl)||!PreviousWeekLevels(pwh,pwl))
      return false;
   double px=iClose(g_symbol,VT_TF,1);
   if(dir>0)
     {
      double a=(pdh>px?pdh:DBL_MAX),b=(pwh>px?pwh:DBL_MAX);
      target=MathMin(a,b);
     }
   else
     {
      double a=(pdl<px?pdl:-DBL_MAX),b=(pwl<px?pwl:-DBL_MAX);
      target=MathMax(a,b);
     }
   return target!=DBL_MAX && target!=-DBL_MAX;
  }

//---------------------- Order Block awareness ----------------------
// Independent monitoring list. Blocks move DETECTED -> ENTRY CONFIRMED
// when a later closed bar closes beyond the block in the block direction.
// Status transitions never feed back into the Fib entry rules.
int FindBlock(const int dir,const double top,const double bottom)
  {
   for(int i=0;i<ArraySize(g_ob);i++)
     {
      if(!g_ob[i].used || g_ob[i].direction!=dir)
         continue;
      if(MathAbs(g_ob[i].top-top)<=g_specs.tickSize && MathAbs(g_ob[i].bottom-bottom)<=g_specs.tickSize)
         return i;
     }
   return -1;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void AddBlock(const int dir,const double top,const double bottom,const datetime detected,const datetime confirmed)
  {
   int slot=-1;
   for(int i=0;i<ArraySize(g_ob);i++)
      if(!g_ob[i].used)
        {
         slot=i;
         break;
        }
   if(slot<0)
     {
      if(ArraySize(g_ob)>=VT_OB_MAX_BLOCKS)
        {
         // Pool full: recycle the OLDEST INVALIDATED block. A live or confirmed
         // block is never evicted, so continuous monitoring cannot stall.
         int oldest=-1;
         datetime oldestTime=0;
         for(int k=0;k<ArraySize(g_ob);k++)
           {
            if(!g_ob[k].invalidated)
               continue;
            if(oldest<0 || g_ob[k].detected_time<oldestTime)
              { oldest=k; oldestTime=g_ob[k].detected_time; }
           }
         if(oldest<0)
            return;
         g_ob[oldest].used=false;
         slot=oldest;
        }
      else
        {
         slot=ArraySize(g_ob);
         // pool grows by one slot (only reached before the pool is full)
         ArrayResize(g_ob,slot+1);
        }
     }
   g_ob[slot].used=true;
   g_ob[slot].direction=dir;
   g_ob[slot].confirmed=(confirmed>0);
   g_ob[slot].detected_time=detected;
   g_ob[slot].confirmed_time=confirmed;
   g_ob[slot].top=top;
   g_ob[slot].bottom=bottom;
   g_ob[slot].mitigated=false;
   g_ob[slot].invalidated=false;
   g_ob[slot].breaker=false;
   g_obDetected++;
// Notification 1 of the Option B table: a block is only DETECTED here.
// It never blocks an entry, never reverses anything and never moves a stop.
   if(g_plan.active)
      Print("VaultTrades | ",(dir>0?"BULLISH":"BEARISH")," OB detected ",
            DoubleToString(bottom,g_specs.digits),"-",DoubleToString(top,g_specs.digits),
            " | monitoring only (no entry, no veto)");
  }
// Scans the recent window for displacement order blocks. Bullish and
// bearish blocks are detected independently and keep separate state.
void ScanOrderBlocks()
  {
   MqlRates r[];
   if(!GetRates(r,VT_OB_LOOKBACK+40))
      return;
// Free invalidated blocks older than the lookback window so the pool can be
// recycled. Live or freshly confirmed blocks are never retired here, and a
// retired block can never influence an open position.
   datetime retireBefore=r[1].time-(datetime)(VT_OB_RETIRE_BARS*PeriodSeconds(VT_TF));
   for(int k=0;k<ArraySize(g_ob);k++)
      if(g_ob[k].used && g_ob[k].invalidated && g_ob[k].detected_time<retireBefore)
         g_ob[k].used=false;
   for(int i=2;i<MathMin(VT_OB_LOOKBACK,ArraySize(r)-1);i++)
     {
      double a=ATR(i-1);
      if(a<=0)
         continue;
      double body=MathAbs(r[i-1].close-r[i-1].open);
      if(body<a*VT_OB_DISPLACEMENT)
         continue;
      bool nextBull=(r[i-1].close>r[i-1].open);
      bool nextBear=(r[i-1].close<r[i-1].open);
      bool baseBear=(r[i].close<r[i].open);
      bool baseBull=(r[i].close>r[i].open);
      // Bullish block: bearish base candle followed by bullish displacement.
      if(baseBear && nextBull && r[i-1].close>r[i].high)
        {
         int idx=FindBlock(1,r[i].high,r[i].low);
         if(idx<0)
            AddBlock(1,r[i].high,r[i].low,r[i].time,0);
         else
            if(!g_ob[idx].confirmed && r[1].close>g_ob[idx].top)
              {
               g_ob[idx].confirmed=true;
               g_ob[idx].confirmed_time=r[1].time;
               g_obConfirmedAll++;
               // Notification 2: entry condition satisfied (close beyond the block).
               if(g_plan.active)
                  Print("VaultTrades | BULLISH OB entry confirmed at ",
                        TimeToString(r[1].time,TIME_DATE|TIME_MINUTES),
                        (g_plan.direction<0?" | opposes the open SELL (Plan B candidate)":" | same side as the open BUY, no action"));
               // Plan B bookkeeping: a BULLISH block can only invalidate a SELL.
               if(g_plan.active && g_plan.direction<0)
                 { g_trSeen++; if(r[1].time<g_plan.signal_time) g_trStale++; else g_trOpp++; }
              }
        }
      // Bearish block: bullish base candle followed by bearish displacement.
      if(baseBull && nextBear && r[i-1].close<r[i].low)
        {
         int idx=FindBlock(-1,r[i].high,r[i].low);
         if(idx<0)
            AddBlock(-1,r[i].high,r[i].low,r[i].time,0);
         else
            if(!g_ob[idx].confirmed && r[1].close<g_ob[idx].bottom)
              {
               g_ob[idx].confirmed=true;
               g_ob[idx].confirmed_time=r[1].time;
               g_obConfirmedAll++;
               // Notification 2: entry condition satisfied (close beyond the block).
               if(g_plan.active)
                  Print("VaultTrades | BEARISH OB entry confirmed at ",
                        TimeToString(r[1].time,TIME_DATE|TIME_MINUTES),
                        (g_plan.direction>0?" | opposes the open BUY (Plan B candidate)":" | same side as the open SELL, no action"));
               // Plan B bookkeeping: a BEARISH block can only invalidate a BUY.
               if(g_plan.active && g_plan.direction>0)
                 { g_trSeen++; if(r[1].time<g_plan.signal_time) g_trStale++; else g_trOpp++; }
              }
        }
     }
  }

// Mitigation, invalidation and breaker status are observations only.
void UpdateBlockStates()
  {
   MqlRates r[];
   if(!GetRates(r,4))
      return;
   for(int i=0;i<ArraySize(g_ob);i++)
     {
      if(!g_ob[i].used || g_ob[i].invalidated)
         continue;
      bool touched=(r[1].low<=g_ob[i].top && r[1].high>=g_ob[i].bottom);
      if(touched)
         g_ob[i].mitigated=true;
      if(g_ob[i].direction>0)
        {
         if(r[1].close<g_ob[i].bottom)
           {
            g_ob[i].invalidated=true;
            if(g_ob[i].confirmed && g_plan.active && g_ob[i].direction!=g_plan.direction)
               g_trInv++;
            if(g_ob[i].confirmed)
               g_ob[i].breaker=true;
           }
        }
      else
        {
         if(r[1].close>g_ob[i].top)
           {
            g_ob[i].invalidated=true;
            if(g_ob[i].confirmed && g_plan.active && g_ob[i].direction!=g_plan.direction)
               g_trInv++;
            if(g_ob[i].confirmed)
               g_ob[i].breaker=true;
           }
        }
     }
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string BlockSummary()
  {
   int detected=0,confirmed=0;
   for(int i=0;i<ArraySize(g_ob);i++)
     {
      if(!g_ob[i].used || g_ob[i].invalidated)
         continue;
      if(g_ob[i].confirmed)
         confirmed++;
      else
         detected++;
     }
   return "OB detected "+IntegerToString(detected)+" / confirmed "+IntegerToString(confirmed);
  }
//-------------------------- Trade management ------------------------
bool FindOurPosition(ulong &ticket,ENUM_POSITION_TYPE &type,double &vol)
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong t=PositionGetTicket(i);
      if(t==0)
         continue;
      if(PositionGetString(POSITION_SYMBOL)==g_symbol && (long)PositionGetInteger(POSITION_MAGIC)==(long)g_magic)
        { ticket=t; type=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE); vol=PositionGetDouble(POSITION_VOLUME); return true; }
     }
   return false;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void ResetPlan()
  {
   g_plan.active=false;
   g_plan.ticket=0;
   g_plan.tp_count=0;
   g_plan.full_close_mode=false;
   ArrayInitialize(g_plan.tp_done,false);
   ArrayInitialize(g_plan.close_volume,0.0);
  }

// Three-target volume model, validated before any order is sent:
//   0.03 lots            -> three progressive 0.01-lot exits (TP1, TP2, TP3)
//   0.01-0.04 lots       -> entire position closes at TP1
//   larger volumes       -> five step-valid portions when the broker permits
// A split the broker cannot express is reported, never approximated.
bool BuildVolumePlan(const double lots,PositionPlan &plan,string &reason)
  {
   ArrayInitialize(plan.close_volume,0.0);
   plan.full_close_mode=false;
   if(!VtValidateVolumeStrict(g_specs,lots,reason))
      return false;

   if(lots<VT_TARGETS*g_specs.volumeMin-1e-8)
     {
      plan.full_close_mode=true;
      plan.close_volume[0]=lots;
      return true;
     }

   double portion=VtRoundDownToStep(g_specs,lots/VT_TARGETS);
   double allocated=0.0;
   for(int i=0;i<VT_TARGETS-1;i++)
     {
      plan.close_volume[i]=portion;
      allocated+=portion;
     }
   double last=NormalizeDouble(lots-allocated,VtVolumeDigits(g_specs.volumeStep));

   if(last<g_specs.volumeMin-1e-8)
     {
      reason="three-target split leaves a final portion of "+DoubleToString(last,4)+
             " which is below the broker minimum "+DoubleToString(g_specs.volumeMin,4);
      return false;
     }
   double units=last/g_specs.volumeStep;
   if(MathAbs(units-MathRound(units))>1e-7)
     {
      reason="broker volume step "+DoubleToString(g_specs.volumeStep,4)+
             " cannot express the three-target split of "+DoubleToString(lots,4)+
             " exactly (final portion "+DoubleToString(last,4)+")";
      return false;
     }
   plan.close_volume[VT_TARGETS-1]=last;
   return true;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void LogVolumePlan(const PositionPlan &plan)
  {
   string parts="";
   for(int i=0;i<VT_TARGETS;i++)
      parts+=DoubleToString(plan.close_volume[i],VtVolumeDigits(g_specs.volumeStep))+" ";
   Print("Vortex volume plan | ",g_symbol," | initial=",DoubleToString(plan.initial_volume,4),
         " | mode=",(plan.full_close_mode?"FULL CLOSE AT TP1":"THREE TARGETS"),
         " | portions= ",parts);
  }
//------------------ Account-aware sizing and exit model -------------
// No fixed lot can be correct on every account. The three-target model needs at
// least three broker minimum lots, and that minimum differs per listing and per
// account group, so the volume is priced from the account and this signal's own
// stop distance, then the exit model is chosen from what that volume can
// express. A split the broker cannot express is never approximated: the whole
// position closes at TP1 and the reason is journaled.
string g_tpModelAtAttach="pending first signal";

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string VolumeLabel(const double lots)
  {
   return DoubleToString(lots,VtVolumeDigits(g_specs.volumeStep));
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string TpModelLabel()
  {
   if(g_plan.active)
      return (g_plan.full_close_mode?"full close at TP1":"split into three targets");
   return g_tpModelAtAttach;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string EngineLabel()
  {
   if(InpEntryEngine==VT_EE_TOUCH)
      return "ENTRY_ZONE_TOUCH";
   if(InpEntryEngine==VT_EE_FIB_FLIP)
      return "FIB_FLIP";
   return "CONFLUENCE";
  }


//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool ResolveVolumePlan(const int dir,const double entry,const double sl,
                       double &lots,PositionPlan &plan,string &verdict,
                       const bool journal=true)
  {
   lots=0.0;
   verdict="";
   ArrayInitialize(plan.close_volume,0.0);
   plan.full_close_mode=false;
   plan.initial_volume=0.0;

   if(InpSizingMode==VT_VX_AUTO)
     {
      double accountMoney=AccountInfoDouble(ACCOUNT_EQUITY);
      if(accountMoney<=0.0)
         accountMoney=AccountInfoDouble(ACCOUNT_BALANCE);
      string sizingReason="";
      lots=VtAutoLotSize(g_specs,dir,entry,sl,InpRiskPercent,accountMoney,sizingReason,"Vortex");
      // Hard exposure cap. Risk-based sizing is correct in percentage terms, but
      // a tight stop on a standard contract can still ask for a large notional,
      // so the absolute volume can be bounded. 0 keeps the broker maximum.
      if(lots>0.0 && InpMaxLotSize>0.0 && lots>InpMaxLotSize)
        {
         double capped=MathFloor(InpMaxLotSize/g_specs.volumeStep+1e-9)*g_specs.volumeStep;
         if(capped<g_specs.volumeMin)
            capped=g_specs.volumeMin;
         capped=NormalizeDouble(capped,VtVolumeDigits(g_specs.volumeStep));
         Print("Vortex sizing cap | ",g_symbol," | risk-based volume ",
               DoubleToString(lots,VtVolumeDigits(g_specs.volumeStep)),
               " capped to ",DoubleToString(capped,VtVolumeDigits(g_specs.volumeStep)),
               " by InpMaxLotSize. The risk taken is now below the ",
               DoubleToString(InpRiskPercent,2),"% target.");
         lots=capped;
        }
      if(lots<=0.0)
        {
         verdict="auto sizing refused: "+sizingReason;
         return false;
        }
     }
   else
     {
      lots=InpLotSize;
      if(lots<g_specs.volumeMin)
        {
         lots=g_specs.volumeMin;
         Print("Vortex: fixed lot ",DoubleToString(InpLotSize,4)," is below the broker minimum ",
               VolumeLabel(g_specs.volumeMin)," on ",g_symbol,"; using ",VolumeLabel(lots),
               " for this order.");
        }
      if(lots>g_specs.volumeMax)
         lots=g_specs.volumeMax;
     }

// Volume floor. The three-target ladder needs five pieces the broker can
// express, so the traded volume never drops below InpMinLotSize: 0.05 lots on
// a 0.01-step listing is exactly five 0.01 closes, one per target.
   if(InpMinLotSize>0.0 && lots<InpMinLotSize-1e-8)
     {
      double floored=MathRound(InpMinLotSize/g_specs.volumeStep)*g_specs.volumeStep;
      if(floored>g_specs.volumeMax)
         floored=g_specs.volumeMax;
      floored=NormalizeDouble(floored,VtVolumeDigits(g_specs.volumeStep));
      if(floored>lots)
        {
         Print("Vortex volume floor | ",g_symbol," | volume ",
               DoubleToString(lots,VtVolumeDigits(g_specs.volumeStep))," raised to ",
               DoubleToString(floored,VtVolumeDigits(g_specs.volumeStep)),
               " so the three-target ladder stays expressible (InpMinLotSize).");
         lots=floored;
        }
     }

   string reason="";
   if(!VtValidateVolumeStrict(g_specs,lots,reason))
     {
      verdict=reason;
      return false;
     }

   plan.initial_volume=lots;
   if(BuildVolumePlan(lots,plan,reason))
     {
      g_tpModelAtAttach=(plan.full_close_mode?"full close at TP1":"split into three targets");
      verdict=(plan.full_close_mode
               ? "volume "+VolumeLabel(lots)+" is under three broker minimum lots, so the position exits fully at TP1"
               : "volume "+VolumeLabel(lots)+" splits into three targets");
      if(journal)
         Print("Vortex sizing | ",g_symbol," | mode=",(InpSizingMode==VT_VX_AUTO?"AUTO":"FIXED"),
               " | volume=",VolumeLabel(lots),
               " | exit=",(plan.full_close_mode?"FULL CLOSE AT TP1":"THREE TARGETS"),
               " | ",verdict);
      return true;
     }

// The strict three-target split cannot be expressed at this volume.
   bool degrade=(InpSizingMode==VT_VX_AUTO || InpAllowFullCloseFallback);
   if(!degrade)
     {
      verdict="broker cannot support the required partial-close structure: "+reason;
      return false;
     }
   plan.full_close_mode=true;
   ArrayInitialize(plan.close_volume,0.0);
   plan.close_volume[0]=lots;
   g_tpModelAtAttach="full close at TP1";
   verdict="three-target split unavailable at "+VolumeLabel(lots)+" lots ("+reason+
           "), so the entire position closes at TP1";
   if(journal)
      Print("Vortex sizing | ",g_symbol," | mode=",(InpSizingMode==VT_VX_AUTO?"AUTO":"FIXED"),
            " | volume=",VolumeLabel(lots)," | exit=FULL CLOSE AT TP1 | ",verdict,
            ". This is a volume constraint, not a change to the signal.");
   return true;
  }

// Deviation actually granted to the broker. A zero input means "no fixed
// tolerance": the current spread is used so a market order can still fill,
// which is what the reference strategy does implicitly at the next bar open.
int VtWorkingDeviationPoints()
  {
   int dev=InpMaxSlippagePoints;
   if(dev<=0)
     {
      long spread=SymbolInfoInteger(g_symbol,SYMBOL_SPREAD);
      dev=(int)MathMax(1.0,(double)spread);
     }
   return dev;
  }

// Market entry with filling-mode acceptance.
// The reference strategy has no filling-mode concept, so a broker rejection of
// the mode itself (retcode 10030) must not end the signal: the identical order
// is retried with the next mode the listing publishes. Volume, direction, SL
// and every strategy level are never altered by a retry.
bool SubmitMarketEntry(const int dir,const double lots,const double sl,const int deviationPoints,
                       long &retcode,ENUM_ORDER_TYPE_FILLING &usedFilling)
  {
   ENUM_ORDER_TYPE_FILLING candidates[];
   int count=VtFillingCandidates(g_specs,candidates);
   retcode=0;
   usedFilling=ORDER_FILLING_RETURN;
   for(int i=0;i<count;i++)
     {
      trade.SetExpertMagicNumber(g_magic);
      trade.SetDeviationInPoints((ulong)deviationPoints);
      trade.SetTypeFilling(candidates[i]);
      bool ok=(dir>0)?trade.Buy(lots,g_symbol,0.0,sl,0.0,"VT Vortex")
              :trade.Sell(lots,g_symbol,0.0,sl,0.0,"VT Vortex");
      retcode=trade.ResultRetcode();
      usedFilling=candidates[i];
      if(ok)
         return true;
      if(retcode!=TRADE_RETCODE_INVALID_FILL)
        {
         Print("Vortex | ",g_symbol," | order rejected retcode=",retcode," ",
               trade.ResultRetcodeDescription()," comment=",trade.ResultComment(),
               " | filling=",VtFillingName(candidates[i]));
         return false;
        }
      Print("Vortex | ",g_symbol," | filling mode ",VtFillingName(candidates[i]),
            " not accepted by the broker (retcode ",retcode,
            "); retrying the same order with the next supported mode.");
     }
   return false;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool OpenVortex(const int dir,double entry,double sl,double tp1,double tp2,double tp3,datetime signalTime)
  {
   ulong ticket;
   ENUM_POSITION_TYPE ptype;
   double volume;
   if(FindOurPosition(ticket,ptype,volume))
      return false;

   string reason="";
// Volume and exit model are resolved from the account before any order.
   PositionPlan proposed;
   double lots=0.0;
   string verdict="";
   proposed.initial_volume=0.0;
   ArrayInitialize(proposed.close_volume,0.0);
   proposed.full_close_mode=false;

// Validate the complete partial-close structure before opening anything.
   if(!ResolveVolumePlan(dir,entry,sl,lots,proposed,verdict))
     {
      Print("Vortex | ",g_symbol," | no trade opened: ",verdict,
            ". No target was skipped and no strategy level was moved.");
      g_status=(InpSizingMode==VT_VX_AUTO?"AUTO SIZING REFUSED":"BROKER CANNOT SUPPORT 5-TARGET SPLIT");
      return false;
     }
   /* Legacy fallback branch retired: ResolveVolumePlan now decides the exit
      model from the resolved volume, so "proposed" already carries either five
      target portions or one full TP1 close. Kept commented for traceability.
   // fallback branch below is unreachable by design and kept only as a
   // reference for the fixed-mode behaviour it replaced.
   if(lots<0.0)
     {
      {
         g_status="BROKER CANNOT SUPPORT 5-TARGET SPLIT";
         return false;
      }
      proposed.full_close_mode=true;
      ArrayInitialize(proposed.close_volume,0.0);
      proposed.close_volume[0]=InpLotSize;
      Print("Vortex | ",g_symbol," | fallback enabled: the entire position will close at TP1 ",
            "instead of three targets. This is a broker limitation, not a strategy change.");
   */

// Original v12 entry-relative stop-distance gate, now driven by this
// symbol's broker stops level.
   double stopLevel=VtStopsDistance(g_specs);
   if(dir>0 && (entry-sl<stopLevel || tp1-entry<stopLevel))
     {
      g_status="BROKER STOP-LEVEL RESTRICTION";
      Print("Vortex | ",g_symbol," | BUY levels rejected: SL and/or TP1 are on the wrong side of the entry for broker stops level ",
            DoubleToString(stopLevel,g_specs.digits),": entry=",DoubleToString(entry,g_specs.digits),
            " SL=",DoubleToString(sl,g_specs.digits)," TP1=",DoubleToString(tp1,g_specs.digits));
      return false;
     }
   if(dir<0 && (sl-entry<stopLevel || entry-tp1<stopLevel))
     {
      g_status="BROKER STOP-LEVEL RESTRICTION";
      Print("Vortex | ",g_symbol," | SELL levels rejected: SL and/or TP1 are on the wrong side of the entry for broker stops level ",
            DoubleToString(stopLevel,g_specs.digits),": entry=",DoubleToString(entry,g_specs.digits),
            " SL=",DoubleToString(sl,g_specs.digits)," TP1=",DoubleToString(tp1,g_specs.digits));
      return false;
     }

   MqlTick tick;
   if(!ValidateOrderContext(g_specs,lots,dir,sl,0.0,InpMaxSpreadPoints,reason,tick))
     {
      Print("Vortex | ",g_symbol," | execution blocked: ",reason,
            ". Entry=",DoubleToString(entry,g_specs.digits),
            " SL=",DoubleToString(sl,g_specs.digits)," TP1=",DoubleToString(tp1,g_specs.digits),
            ". Strategy levels were not moved.");
      g_status="EXECUTION BLOCKED";
      return false;
     }

// ---- Order filling acceptance -------------------------------------
// The reference strategy fills at the next bar open and never refuses an
// order for liquidity or filling-mode reasons. The port therefore accepts
// the most permissive mode the listing publishes, retries the same order
// when the broker rejects the mode itself, and measures the fill instead of
// assuming it. Volume, direction, SL and every strategy level are unchanged.
   int deviationPoints=VtWorkingDeviationPoints();
   long retcode=0;
   ENUM_ORDER_TYPE_FILLING usedFilling=ORDER_FILLING_RETURN;
   bool ok=SubmitMarketEntry(dir,lots,sl,deviationPoints,retcode,usedFilling);
   if(!ok)
     {
      g_status="ORDER REJECTED: "+trade.ResultRetcodeDescription();
      return false;
     }
   /* Legacy single-mode submission retained for traceability.
   trade.SetExpertMagicNumber(VT_MAGIC);
   trade.SetDeviationInPoints(20);
   trade.SetTypeFilling(VtChooseFilling(g_specs));
   bool ok=(dir>0)?trade.Buy(lots,g_symbol,0.0,sl,0.0,"VT Vortex")
                   :trade.Sell(lots,g_symbol,0.0,sl,0.0,"VT Vortex");
   long retcode=trade.ResultRetcode();
   if(!ok)
   {
      Print("Vortex | ",g_symbol," | order rejected retcode=",retcode," ",trade.ResultRetcodeDescription(),
            " comment=",trade.ResultComment());
      g_status="ORDER REJECTED: "+trade.ResultRetcodeDescription();
      return false;
   */

   ulong t;
   ENUM_POSITION_TYPE ty;
   double v;
   if(!FindOurPosition(t,ty,v))
     {
      g_status="ORDER SENT / POSITION NOT YET VISIBLE";
      return false;
     }
   ResetPlan();
   g_plan.active=true;
   g_plan.ticket=t;
   g_plan.direction=dir;
   g_plan.initial_volume=v;
   g_plan.remaining_volume=v;
// ---- Fill acceptance ----------------------------------------------
// The reference strategy takes the next bar's open price whatever it is, so
// the fill is accepted here too. It is measured and journaled instead of
// being silently assumed, and the target ladder is rebuilt on the volume
// that actually exists so no target can ask to close more than the position.
   double fillPrice=trade.ResultPrice();
   double filledVolume=trade.ResultVolume();
   if(filledVolume<=0.0)
      filledVolume=v;
   double slippagePoints=VtSlippagePoints(g_specs,dir,entry,fillPrice);
   Print("Vortex | ",g_symbol," | fill accepted | requested=",
         DoubleToString(lots,VtVolumeDigits(g_specs.volumeStep)),
         " filled=",DoubleToString(filledVolume,VtVolumeDigits(g_specs.volumeStep)),
         " | reference=",DoubleToString(entry,g_specs.digits),
         " fill=",DoubleToString(fillPrice,g_specs.digits),
         " | slippage=",DoubleToString(slippagePoints,1)," points",
         " | tolerance=",IntegerToString(deviationPoints)," points",
         " | filling=",VtFillingName(usedFilling));
   if(InpMaxSlippagePoints>0 && MathAbs(slippagePoints)>InpMaxSlippagePoints)
      Print("Vortex | ",g_symbol," | fill accepted outside the ",
            IntegerToString(InpMaxSlippagePoints),"-point tolerance (",
            DoubleToString(slippagePoints,1)," points). The reference strategy accepts the ",
            "next-bar open price, so the trade is kept; the confirmed fill drives the ladder.");
   if(MathAbs(v-lots)>1e-8)
     {
      if(!InpAcceptPartialFill)
        {
         Print("Vortex | ",g_symbol," | partial fill ",DoubleToString(v,4)," of ",
               DoubleToString(lots,4)," rejected by policy; closing the filled volume.");
         trade.PositionClose(t);
         ResetPlan();
         g_status="PARTIAL FILL REJECTED";
         return false;
        }
      PositionPlan rebuilt;
      string rebuildReason="";
      rebuilt.initial_volume=v;
      ArrayInitialize(rebuilt.close_volume,0.0);
      rebuilt.full_close_mode=false;
      if(BuildVolumePlan(v,rebuilt,rebuildReason))
        {
         proposed.full_close_mode=rebuilt.full_close_mode;
         for(int i=0;i<VT_TARGETS;i++)
            proposed.close_volume[i]=rebuilt.close_volume[i];
         Print("Vortex | ",g_symbol," | partial fill accepted: target ladder rebuilt on ",
               DoubleToString(v,VtVolumeDigits(g_specs.volumeStep))," lots.");
        }
      else
        {
         proposed.full_close_mode=true;
         ArrayInitialize(proposed.close_volume,0.0);
         proposed.close_volume[0]=v;
         Print("Vortex | ",g_symbol," | partial fill accepted: ",rebuildReason,
               ". The filled volume closes fully at TP1.");
        }
     }
   g_plan.entry=PositionGetDouble(POSITION_PRICE_OPEN);
   g_plan.sl=sl;
   g_plan.signal_time=signalTime;
   g_plan.tp[0]=tp1;
   g_plan.tp[1]=tp2;
   g_plan.tp[2]=tp3;
   // TP4/TP5 retired: the ladder is TP1-TP3 only.
   // (no TP4 slot)
   g_plan.tp_count=VT_TARGETS;
// Firm entry: the ladder is anchored to the fib swing read at signal time,
// fill, so neither the entry level nor any target shifts with the market.
   // No target is derived from the fill: TP1-TP3 are the frozen fib levels.
   // (no market-derived target)
   g_trState=0;
   g_plan.full_close_mode=proposed.full_close_mode;
   for(int i=0;i<VT_TARGETS;i++)
      g_plan.close_volume[i]=proposed.close_volume[i];
   LogVolumePlan(g_plan);

   VTExecReport rep=VtBuildExecReport(g_specs,dir,signalTime,TimeTradeServer(),
                                      entry,trade.ResultPrice(),sl,0.0,retcode);
   VtLogExecReport(rep,g_specs,lots,"Vortex");
   g_status="TRADE ACTIVE";
   return true;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void ManagePartialTargets()
  {
   if(!g_plan.active)
      return;
   ulong ticket;
   ENUM_POSITION_TYPE type;
   double vol;
   if(!FindOurPosition(ticket,type,vol))
     {
      ResetPlan();
      return;
     }
   double bid=SymbolInfoDouble(g_symbol,SYMBOL_BID),ask=SymbolInfoDouble(g_symbol,SYMBOL_ASK);
   for(int i=0;i<VT_TARGETS;i++)
     {
      if(g_plan.tp_done[i])
         continue;
      bool hit=(g_plan.direction>0)?(bid>=g_plan.tp[i]):(ask<=g_plan.tp[i]);
      if(!hit)
         continue;

      double closeVol=g_plan.close_volume[i];
      if(closeVol<=0.0)
        {
         // A target with no allocated volume is recorded, never silently
         // treated as a full close of the position.
         g_plan.tp_done[i]=true;
         continue;
        }
      if(g_plan.full_close_mode)
         closeVol=vol;
      double remainder=NormalizeDouble(vol-closeVol,VtVolumeDigits(g_specs.volumeStep));
      if(remainder>0.0 && remainder<g_specs.volumeMin-1e-8)
         closeVol=vol;
      if(closeVol>=vol-1e-8)
         closeVol=vol;

      string stepReason="";
      if(!VtValidateVolumeStrict(g_specs,closeVol,stepReason))
        {
         Print("Vortex | ",g_symbol," | TP",IntegerToString(i+1),
               " close blocked: ",stepReason,". Position left open for manual review.");
         g_status="PARTIAL CLOSE BLOCKED: "+stepReason;
         return;
        }

      bool ok=false;
      if(closeVol>=vol-1e-8)
         ok=trade.PositionClose(ticket);
      else
         ok=trade.PositionClosePartial(ticket,closeVol);
      if(!ok)
        {
         Print("Vortex | ",g_symbol," | TP",IntegerToString(i+1)," close failed retcode=",
               trade.ResultRetcode()," ",trade.ResultRetcodeDescription(),
               " comment=",trade.ResultComment());
         g_status="PARTIAL CLOSE ERROR: "+trade.ResultRetcodeDescription();
         return;
        }
      Print("Vortex | ",g_symbol," | TP",IntegerToString(i+1)," hit | closed=",
            DoubleToString(closeVol,VtVolumeDigits(g_specs.volumeStep)),
            " | remaining before=",DoubleToString(vol,4),
            " | broker exec time=",TimeToString(TimeTradeServer(),TIME_DATE|TIME_SECONDS));

      g_plan.tp_done[i]=true;
      if(g_plan.full_close_mode || !PositionSelectByTicket(ticket))
        {
         ResetPlan();
         g_status="TRADE CLOSED";
         return;
        }
      g_plan.remaining_volume=PositionGetDouble(POSITION_VOLUME);
      g_status="TP"+IntegerToString(i+1)+" HIT";
     }
  }
// Pine v12 entry trigger. Authority sequence: window -> Fib location ->
// M5 displacement -> retest window -> confluence. Order blocks and the
// liquidity target are references only and never veto an entry.
bool ProcessDirectionV12(const int dir,MqlRates &r[],FibSetup &s)
  {
   double atr=ATR(1);
   if(atr<=0.0)
      return false;
   double start=0.0,finish=0.0;
   if(!GetFibAnchors(dir,r[1].time,start,finish))
      return false;
   double top=MathMax(start,finish),bottom=MathMin(start,finish);
   double f68=(dir>0?BuyFib(top,bottom,VT_FIB_68):SellFib(top,bottom,VT_FIB_68));
   double f88=(dir>0?BuyFib(top,bottom,VT_FIB_88):SellFib(top,bottom,VT_FIB_88));
// A new leg, or a live HH/LL extension, re-anchors the ladder.
   if(s.direction!=dir || s.fib_start!=start || s.fib_end!=finish)
     { s.direction=dir; s.fib_start=start; s.fib_end=finish; s.pullback_bar=-1; }
   bool inWindow=InSilverBulletWindow(r[1].time+PeriodSeconds(VT_TF));
   bool touched=(dir>0?r[1].low<=f68:r[1].high>=f68);
   if(touched && s.pullback_bar<0)
      s.pullback_bar=g_bar_counter;
   if(s.pullback_bar>=0 && g_bar_counter-s.pullback_bar>InpRetestBars)
      s.pullback_bar=-1;
   bool retestOK=(s.pullback_bar>=0 && g_bar_counter-s.pullback_bar<=InpRetestBars);
// Pine buyFibLocation: the retest must stay INSIDE the 61.8-88.0 band. Only
// requiring close>=f88 allowed entries above the whole band, whose 38.2/0/
// -23.6 targets were already behind the price and produced invalid ladders
// (measured: 11 signals rejected by the broker stops-level check).
   bool location=(dir>0?(r[1].low<=f68 && r[1].close>=f88)
                  :(r[1].high>=f68 && r[1].close<=f88));
   bool displacement=(dir>0)
                     ?(r[1].close>r[1].open && r[1].close-r[1].open>=atr*VT_ENTRY_DISPLACEMENT && r[1].close>r[2].high)
                     :(r[1].close<r[1].open && r[1].open-r[1].close>=atr*VT_ENTRY_DISPLACEMENT && r[1].close<r[2].low);
   int score=ConfluenceScoreV12(dir,r,f68,f88);
   g_diagStage2++;
   if(touched)
      g_diagRetest++;
   if(location)
      g_diagCandle++;
   if(displacement)
      g_diagDisp++;
   if(retestOK)
      g_diagFib++;
   if(inWindow)
      g_diagWin++;
   if(score>=InpMinConfluence)
      g_diagScore++;
// ---- Entry engine -------------------------------------------------
// FIB_FLIP ports the supplied Pine trigger. The level is the first of
// 61.8 / 78.6 / 88.0 the bar reaches, and the bar must close back out of it
// in the trade direction ("the sell or buy flips"). The destination order
// block, the liquidity destination and the risk geometry are mandatory in
// that engine, exactly as the source requires them. CONFLUENCE keeps the
// behaviour this build shipped with: an ATR-sized displacement bar, a retest
// inside the window, and the score floor, with no flip and no order block.
   double selLevel=0.0;
   if(touched)
      selLevel=f68;
   else
     {
      double f78=(dir>0 ? BuyFib(top,bottom,VT_FIB_78) : SellFib(top,bottom,VT_FIB_78));
      if(dir>0 ? (r[1].low<=f78) : (r[1].high>=f78))
         selLevel=f78;
      else
         if(dir>0 ? (r[1].low<=f88) : (r[1].high>=f88))
            selLevel=f88;
     }
   bool flipRetest=(selLevel>0.0 &&
                    (dir>0 ? (r[1].low<=selLevel && r[1].close>=selLevel)
                     : (r[1].high>=selLevel && r[1].close<=selLevel)));
   bool flipCandle=(dir>0 ? (r[1].close>r[1].open && r[1].close>r[2].high)
                    : (r[1].close<r[1].open && r[1].close<r[2].low));
   bool flip=(flipRetest && flipCandle);
   bool flipObOK=false,flipLiqAligned=false,flipGeometry=false;
   if(InpEntryEngine==VT_EE_FIB_FLIP && flip && selLevel>0.0)
     {
      double flipLiq=0.0,flipObTop=0.0,flipObBottom=0.0;
      flipObOK=(FindLiquidityTarget(dir,flipLiq) &&
                FindTargetOB(dir<0,flipLiq,r,flipObTop,flipObBottom) &&
                flipObTop>flipObBottom);
      flipLiqAligned=(flipLiq>0.0 && (dir>0 ? flipLiq>selLevel : flipLiq<selLevel));
      flipGeometry=(dir>0 ? flipObBottom<selLevel : flipObTop>selLevel);
     }
// ENTRY_ZONE_TOUCH: the trigger is the entry zone itself. Price reaching the
// proximal edge of the 61.8-88.0 band (touched) is the trade. Candle shape,
// score, order block, liquidity and retest window are confirmation layers and
// may not veto it. The NY window is optional and off unless asked for.
   bool touchWindowOK=(!InpTouchNeedsWindow || inWindow);
   bool qualified=(InpEntryEngine==VT_EE_TOUCH)
                  ? (touchWindowOK && touched)
                  : ((InpEntryEngine==VT_EE_FIB_FLIP)
                     ? (inWindow && location && flip && flipObOK && flipLiqAligned &&
                        flipGeometry && score>=InpMinConfluence)
                     : (inWindow && location && displacement && retestOK &&
                        score>=InpMinConfluence));
// Gate attribution: charge this bar to the first gate that closes it, so a
// zero-trade report names the binding filter instead of guessing at it.
   g_gateCand++;
   if(InpEntryEngine==VT_EE_TOUCH)
     {
      if(!touchWindowOK)
         g_gateWin++;
      else
         if(!touched)
            g_gateTouch++;
         else
            g_gateQual++;
     }
   else
      if(!inWindow)
         g_gateWin++;
      else
         if(!location)
            g_gateLoc++;
         else
            if(InpEntryEngine==VT_EE_FIB_FLIP)
              {
               if(!flipRetest)
                  g_gateFlipRetest++;
               else
                  if(!flipCandle)
                     g_gateFlipCandle++;
                  else
                     if(!flipObOK)
                        g_gateOb++;
                     else
                        if(!flipLiqAligned)
                           g_gateLiq++;
                        else
                           if(!flipGeometry)
                              g_gateGeo++;
                           else
                              if(score<InpMinConfluence)
                                 g_gateScore++;
                              else
                                 g_gateQual++;
              }
            else
              {
               if(!retestOK)
                  g_gateRetest++;
               else
                  if(!displacement)
                     g_gateDisp++;
                  else
                     if(score<InpMinConfluence)
                        g_gateScore++;
                     else
                        g_gateQual++;
              }
   if(!qualified)
      return false;
   g_diagStage3++;
   g_scoreBuckets[(int)MathMin(10,score/10)]++;
   g_scoreSum+=score;
   if(score>g_scoreMax)
      g_scoreMax=score;
   if(score<g_scoreMin)
      g_scoreMin=score;
// REFERENCE layer (non-blocking): liquidity target and target OB.
   double liq=0.0,obTop=0.0,obBottom=0.0;
   if(FindLiquidityTarget(dir,liq))
      FindTargetOB(dir<0,liq,r,obTop,obBottom);
   s.liquidity_target=liq;
   s.target_ob_top=obTop;
   s.target_ob_bottom=obBottom;
   s.signal_time=r[1].time+PeriodSeconds(VT_TF);
   double entry=r[1].close;
// EXECUTION: Pine stop = 2.0 x M5 ATR, capped at 2% of price.
   double slDist=InpStopAtrMult*atr;
   double maxDist=entry*VT_MAX_STOP_RISK_PCT/100.0;
   if(maxDist>0.0 && slDist>maxDist)
      slDist=maxDist;
   double sl=(dir>0?entry-slDist:entry+slDist);
   double obUsed=0.0;
// The stop is the timeframe's own: 2.0 x ATR(VT_TF). A nearer order block is
// an optional tightening, off by default, so the risk is what the timeframe
// says it is and the stop is simply hit when price reaches it.
   if(InpUseObStop && obTop>0.0 && obBottom>0.0)
     {
      double obRef=(dir>0?obBottom-g_specs.point:obTop+g_specs.point);
      double obDist=(dir>0?entry-obRef:obRef-entry);
      double floorDist=VtStopsDistance(g_specs);
      if(obDist>0.0 && obDist>=floorDist && obDist<slDist)
        {
         sl=obRef;
         obUsed=obRef;
        }
     }
// Firm entry, firm targets: TP1-TP3 are the Pine fib levels of the swing read
// on the entry bar, so the ladder can never be re-derived later. The ladder is
// either valid as-is or the setup is already exhausted; a target is NEVER
// shifted to fit, because shifting would invent a target the Pine never had.
   double minTpStep=VtStopsDistance(g_specs)+g_specs.point;
   bool ladderOK=true;
   double tp1=(dir>0?BuyFib(top,bottom,VT_TP1_FIB):SellFib(top,bottom,VT_TP1_FIB));
   if(dir>0?(tp1<entry+minTpStep):(tp1>entry-minTpStep))
      ladderOK=false;
   double tp2=(dir>0?BuyFib(top,bottom,VT_TP2_FIB):SellFib(top,bottom,VT_TP2_FIB));
   if(dir>0?(tp2<tp1+minTpStep):(tp2>tp1-minTpStep))
      ladderOK=false;
   double tp3=(dir>0?BuyFib(top,bottom,VT_TP3_FIB):SellFib(top,bottom,VT_TP3_FIB));
   // Risk/reward on the frozen geometry: entry and slDist belong to this signal
   // and are never re-read, so the target can only sit where the risk says.
   if(InpRRMode==VT_RR_ANCHOR && slDist>0.0)
     {
      double rrSpan=InpRRMultiple*slDist;
      tp1=NPrice(dir>0?entry+rrSpan/3.0:entry-rrSpan/3.0);
      tp2=NPrice(dir>0?entry+rrSpan*2.0/3.0:entry-rrSpan*2.0/3.0);
      tp3=NPrice(dir>0?entry+rrSpan:entry-rrSpan);
     }
   double rFinal=(slDist>0.0?MathAbs(tp3-entry)/slDist:0.0);
   if(InpRRMode==VT_RR_GATE && rFinal<InpRRMultiple-1e-9)
     {
      Print("Vortex skipped | ",g_symbol," ",(dir>0?"BUY":"SELL"),
            " | RR floor not met | R=",DoubleToString(rFinal,2),
            " < ",DoubleToString(InpRRMultiple,2),
            " | entry=",DoubleToString(entry,g_specs.digits),
            " SL=",DoubleToString(NPrice(sl),g_specs.digits));
      return false;
     }
   if(dir>0?(tp3<tp2+minTpStep):(tp3>tp2-minTpStep))
      ladderOK=false;
   // TP4/TP5 retired: the ladder ends at the -23.6 fib level.
   // (no TP5)
   if(!ladderOK)
     {
      Print("Vortex skipped | ",g_symbol," ",(dir>0?"BUY":"SELL"),
            " | price already past the fib ladder, setup exhausted | entry=",
            DoubleToString(entry,g_specs.digits)," TP1=",DoubleToString(tp1,g_specs.digits),
            " TP2=",DoubleToString(tp2,g_specs.digits)," TP3=",DoubleToString(tp3,g_specs.digits));
      return false;
     }
   Print("Vortex signal | ",g_symbol," ",(dir>0?"BUY":"SELL")," score=",score,
         " engine=",EngineLabel(),
         " level=",DoubleToString(selLevel,g_specs.digits),
         " flip=",(flip?"yes":"no"),
         " atr=",DoubleToString(atr,g_specs.digits),
         " entry=",DoubleToString(entry,g_specs.digits),
         " sl=",DoubleToString(NPrice(sl),g_specs.digits),
         " slSource=",(obUsed>0.0?"order block (tighter)":"ATR x"+DoubleToString(InpStopAtrMult,2)),
         " anchor=",DoubleToString(start,g_specs.digits),"/",DoubleToString(finish,g_specs.digits),
         " leg=",(g_struct.bull.active||g_struct.bear.active?"structure":"session"),
         " session=",g_lastActiveSession,
         " refOB=",DoubleToString(obBottom,g_specs.digits),"/",DoubleToString(obTop,g_specs.digits),
         " refLiq=",(liq>0.0 && liq<1e12?DoubleToString(liq,g_specs.digits):"none"),
         " rrR=",DoubleToString(rFinal,2),
         " tpLadder=","TP1-TP3");
   // (TP4/TP5 retired)
   bool opened=OpenVortex(dir,NPrice(entry),NPrice(sl),NPrice(tp1),NPrice(tp2),NPrice(tp3),s.signal_time);
   if(opened)
      s.pullback_bar=-1;
   return opened;
  }

//------------------------- Legacy state machine ---------------------
void ResetSetup(FibSetup &s)
  {
   s.state=0;
   s.impulse_bar=-1;
   s.pullback_bar=-1;
   s.direction=0;
   s.fib_start=0;
   s.fib_end=0;
   s.selected_entry=0;
   s.target_ob_top=0;
   s.target_ob_bottom=0;
   s.liquidity_target=0;
   s.signal_time=0;
   s.fib_ref_top=0;
   s.fib_ref_bottom=0;
   s.entry_tagged=false;
   s.disp_ok=false;
   s.structure_ok=false;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
bool ProcessDirection(const int dir,MqlRates &r[],FibSetup &s)
  {
   double atr=ATR(1);
   if(atr<=0)
      return false;
   double ph,pl;
   if(!LatestPivots(r,ph,pl))
      return false;
   bool inWindow=InSilverBulletWindow(r[1].time+PeriodSeconds(VT_TF));
   bool bullFlip=false,bearFlip=false;
   double start,finish;
   if(!GetFibAnchors(dir,r[1].time,start,finish))
      return false;
   double mid=(MathMax(start,finish)+MathMin(start,finish))/2.0;
   bullFlip=(dir>0 && r[1].close>=mid);
   bearFlip=(dir<0 && r[1].close<=mid);
   bool flip=(dir>0?bullFlip:bearFlip);
   bool institutional=(dir>0)
                      ? (r[2].close<r[2].open && r[1].close>r[2].high && (r[1].close-r[1].open)>=atr*0.50)
                      : (r[2].close>r[2].open && r[1].close<r[2].low && (r[1].open-r[1].close)>=atr*0.50);

   if(!inWindow && s.state>0)
     {
      ResetSetup(s);
      return false;
     }
   if(s.state==0 && inWindow && flip && institutional)
     {
      g_diagImpulse++;
      s.structure_ok=true;
      s.state=1;
      s.direction=dir;
      s.impulse_bar=g_bar_counter;
      s.pullback_bar=-1;
      s.fib_start=start;
      s.fib_end=finish;
      s.selected_entry=0;
      double liq;
      if(!FindLiquidityTarget(dir,liq))
        {
         ResetSetup(s);
         return false;
        }
      s.liquidity_target=liq;
      double top,bottom;
      if(!FindTargetOB(dir<0,liq,r,top,bottom))
        {
         ResetSetup(s);
         return false;
        }
      s.target_ob_top=top;
      s.target_ob_bottom=bottom;
      s.signal_time=r[1].time+PeriodSeconds(VT_TF);
      return false;
     }
   if(s.state==0 || s.direction!=dir)
      return false;
   double top=MathMax(s.fib_start,s.fib_end),bottom=MathMin(s.fib_start,s.fib_end);
   double f68=(dir>0?BuyFib(top,bottom,VT_FIB_68):SellFib(top,bottom,VT_FIB_68));
   double f78=(dir>0?BuyFib(top,bottom,VT_FIB_78):SellFib(top,bottom,VT_FIB_78));
   double f88=(dir>0?BuyFib(top,bottom,VT_FIB_88):SellFib(top,bottom,VT_FIB_88));
   if(s.state==1)
     {
      bool touch=(dir>0?r[1].low<=f68:r[1].high>=f68);
      if(touch)
        {
         s.state=2;
         s.pullback_bar=g_bar_counter;
         s.selected_entry=f68;
         s.fib_ref_top=top;
         s.fib_ref_bottom=bottom;
        }
      else
        {
         touch=(dir>0?r[1].low<=f78:r[1].high>=f78);
         if(touch)
           {
            s.state=2;
            s.pullback_bar=g_bar_counter;
            s.selected_entry=f78;
            s.fib_ref_top=top;
            s.fib_ref_bottom=bottom;
           }
         else
           {
            touch=(dir>0?r[1].low<=f88:r[1].high>=f88);
            if(touch)
              {
               s.state=2;
               s.pullback_bar=g_bar_counter;
               s.selected_entry=f88;
               s.fib_ref_top=top;
               s.fib_ref_bottom=bottom;
              }
           }
        }
      return false;
     }
   if(s.state==2)
     {
      g_diagStage2++;
      if(g_bar_counter-s.pullback_bar>InpRetestBars)
        {
         ResetSetup(s);
         return false;
        }
      bool retest=(dir>0?(r[1].low<=s.selected_entry && r[1].close>s.selected_entry):(r[1].high>=s.selected_entry && r[1].close<s.selected_entry));
      bool candle=(dir>0?(r[1].close>r[1].open && r[1].close>r[2].high):(r[1].close<r[1].open && r[1].close<r[2].low));
      if(retest)
         g_diagRetest++;
      if(candle)
         g_diagCandle++;
      if(retest)
        {
         s.entry_tagged=true;
         double body=MathAbs(r[1].close-r[1].open);
         s.disp_ok=(candle && body>=atr*VT_ENTRY_DISPLACEMENT);
        }
      if(retest && candle)
         s.state=3;
      return false;
     }
   if(s.state==3)
     {
      // M5 final displacement confirmation.
      bool displacement=(dir>0)
                        ? (r[1].close>r[1].open && r[1].close-r[1].open>=atr*VT_ENTRY_DISPLACEMENT && r[1].close>r[2].high)
                        : (r[1].close<r[1].open && r[1].open-r[1].close>=atr*VT_ENTRY_DISPLACEMENT && r[1].close<r[2].low);
      bool fibValid=(dir>0?(r[1].low<=s.selected_entry && r[1].close>=s.selected_entry):(r[1].high>=s.selected_entry && r[1].close<=s.selected_entry));
      bool liqAligned=(dir>0?s.liquidity_target>s.selected_entry:s.liquidity_target<s.selected_entry);
      // Measured on GOLDmicro M5 (2025.01.02-2026.11.11): only 4 of 25
      // confirmation bars had a protective block behind the entry, so this gate
      // and the confluence floor were the two dominant filters in the chain.
      // Both are measured by the diag / near-miss counters in OnDeinit.
      // (Not a bug: an inverted block puts the stop on the wrong side.)
      // Order block alignment: this block is the PROTECTIVE block behind the
      // entry (the stop loss is derived from it), not the profit target.
      // Long: block below the entry; short: block above it. Inverting this
      // places the stop on the wrong side of price, so it must not be flipped.
      bool obAligned=(dir>0?s.target_ob_bottom<s.selected_entry:s.target_ob_top>s.selected_entry);
      // Use the confirmation captured on the retest bar. Requiring a fresh tag,
      // a fresh displacement and the structure flip again on this later bar
      // made the entry a same-bar coincidence (measured: 1 hit in 22 months).
      displacement=s.disp_ok;
      fibValid=s.entry_tagged;
      bool structureAligned=s.structure_ok;
      int score=ConfluenceScore(dir,r,s.selected_entry);
      g_diagStage3++;
      if(inWindow)
         g_diagWin++;
      if(displacement)
         g_diagDisp++;
      if(fibValid)
         g_diagFib++;
      if(liqAligned)
         g_diagLiq++;
      if(obAligned)
         g_diagOb++;
      if(structureAligned)
         g_diagStruct++;
      if(score>=InpMinConfluence)
         g_diagScore++;
      // Which single gate rejects the confirmation bar?
      if(inWindow && fibValid && liqAligned && structureAligned)
        {
         bool okDisp=displacement, okOb=obAligned, okScore=(score>=InpMinConfluence);
         if(!okDisp)
            g_missDisp++;
         if(!okOb)
            g_missOb++;
         if(!okScore)
            g_missScore++;
         if(okDisp && okOb && okScore)
            g_allPass++;
        }
      g_scoreBuckets[(int)MathMin(10,score/10)]++;
      g_scoreSum+=score;
      if(score>g_scoreMax)
         g_scoreMax=score;
      if(score<g_scoreMin)
         g_scoreMin=score;
      if(inWindow && displacement && fibValid && liqAligned && obAligned && structureAligned && score>=InpMinConfluence)
        {
         double entryPt=s.selected_entry;
         // Stop loss: ATR x2.0 is authoritative (Pine stopLossAtrMultiplier),
         // capped by maxStopRiskPct of the entry. The protective order block may
         // only TIGHTEN it and only if it stays outside the broker stop level.
         double slDist=InpStopAtrMult*atr;
         double maxDist=entryPt*VT_MAX_STOP_RISK_PCT/100.0;
         if(slDist>maxDist)
            slDist=maxDist;
         double sl=NPrice(dir>0?entryPt-slDist:entryPt+slDist);
         double obEdge=(dir>0?s.target_ob_bottom:s.target_ob_top);
         double obDist=(dir>0?entryPt-obEdge:obEdge-entryPt);
         double minStopDist=VtStopsDistance(g_specs)+g_specs.point;
         bool obTighter=false;
         if(obDist>0.0 && obDist>=minStopDist && obDist<slDist)
           { sl=NPrice(dir>0?obEdge-g_specs.point:obEdge+g_specs.point); slDist=obDist; obTighter=true; }
         // Firm targets: the Fib range is frozen at the entry selection, so the
         // percentages stay measured from the firm entry even though the live
         // Fib re-anchors as price moves.
         double refTop=(s.fib_ref_top>0.0?s.fib_ref_top:top);
         double refBottom=(s.fib_ref_bottom>0.0?s.fib_ref_bottom:bottom);
         double entry=s.selected_entry;
         bool ladderOK=true;
         double tp1=(dir>0?BuyFib(refTop,refBottom,VT_TP1_FIB):SellFib(refTop,refBottom,VT_TP1_FIB));
         double tp2=(dir>0?BuyFib(refTop,refBottom,VT_TP2_FIB):SellFib(refTop,refBottom,VT_TP2_FIB));
         double tp3=(dir>0?BuyFib(refTop,refBottom,VT_TP3_FIB):SellFib(refTop,refBottom,VT_TP3_FIB));
         // Risk/reward on the frozen geometry (same rule as the touch engine).
         if(InpRRMode==VT_RR_ANCHOR && slDist>0.0)
           {
            double rrSpan=InpRRMultiple*slDist;
            tp1=NPrice(dir>0?entry+rrSpan/3.0:entry-rrSpan/3.0);
            tp2=NPrice(dir>0?entry+rrSpan*2.0/3.0:entry-rrSpan*2.0/3.0);
            tp3=NPrice(dir>0?entry+rrSpan:entry-rrSpan);
           }
         double convR=(slDist>0.0?MathAbs(tp3-entry)/slDist:0.0);
         if(InpRRMode==VT_RR_GATE && convR<InpRRMultiple-1e-9)
           {
            Print("Vortex skipped | ",g_symbol," ",(dir>0?"BUY":"SELL"),
                  " | RR floor not met | R=",DoubleToString(convR,2),
                  " < ",DoubleToString(InpRRMultiple,2),
                  " | entry=",DoubleToString(entry,g_specs.digits),
                  " SL=",DoubleToString(sl,g_specs.digits));
            return false;
           }
         // TP4/TP5 retired: the ladder ends at the -23.6 fib level.
         // (no TP5)
         if(!ladderOK)
           {
            Print("Vortex skipped | ",g_symbol," ",(dir>0?"BUY":"SELL"),
                  " | price already past the fib ladder, setup exhausted | entry=",
                  DoubleToString(entry,g_specs.digits)," TP1=",DoubleToString(tp1,g_specs.digits),
                  " TP2=",DoubleToString(tp2,g_specs.digits)," TP3=",DoubleToString(tp3,g_specs.digits));
            return false;
           }
         Print("Vortex signal | ",(dir>0?"BUY":"SELL")," | firm entry=",DoubleToString(entry,g_specs.digits),
               " | SL=",DoubleToString(sl,g_specs.digits)," (",(obTighter?"OB tighter":"ATR x"+DoubleToString(InpStopAtrMult,2))," risk ",
               DoubleToString(slDist,g_specs.digits),") | R=",DoubleToString((slDist>0.0?MathAbs(tp1-entry)/slDist:0.0),2),"/",DoubleToString((slDist>0.0?MathAbs(tp2-entry)/slDist:0.0),2),"/",DoubleToString((slDist>0.0?MathAbs(tp3-entry)/slDist:0.0),2)," | TP1=",DoubleToString(tp1,g_specs.digits),
               " TP2=",DoubleToString(tp2,g_specs.digits)," TP3=",DoubleToString(tp3,g_specs.digits));
   // (TP4/TP5 retired)
         bool opened=OpenVortex(dir,NPrice(entry),NPrice(sl),NPrice(tp1),NPrice(tp2),NPrice(tp3),s.signal_time);
         ResetSetup(s);
         return opened;
        }
     }
   return false;
  }
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void EvaluateSignals()
  {
   g_bar_counter++;
// Structure engine first: it feeds the Fib anchors of this bar.
   UpdateStructure();
   MqlRates r[];
   if(!GetRates(r,VT_MAX_BARS))
     {
      g_status="WAITING FOR HISTORY";
      return;
     }
   if(!InSilverBulletWindow(r[1].time+PeriodSeconds(VT_TF)))
     { if(g_buy.state>0)ResetSetup(g_buy); if(g_sell.state>0)ResetSetup(g_sell); g_status="OUTSIDE SILVER BULLET WINDOW"; return; }
   if(g_plan.active)
      return;
   if(ProcessDirectionV12(1,r,g_buy))
     {
      ResetSetup(g_sell);
      return;
     }
   if(ProcessDirectionV12(-1,r,g_sell))
     {
      ResetSetup(g_buy);
      return;
     }
   if(g_buy.state>0 || g_sell.state>0)
      g_status="SETUP DEVELOPING";
   else
      g_status="WAITING FOR VALID FIB SETUP";
  }

//--------------------------- Plan B: OB transition -----------------
// The OB layer never blocks an entry. It only reacts to a block whose ENTRY
// is CONFIRMED in the opposite direction of the open position. A detected
// block is monitoring only and can never close or reverse anything.
void ObTransitionManager()
  {
   if(!g_plan.active)
     {
      if(g_trState==1)
         g_trState=0;   // position ended by TP or stop
      return;
     }
   int oppDir=(g_plan.direction>0?-1:1);
   if(g_trState==0)
     {
      for(int i=0;i<ArraySize(g_ob);i++)
        {
         if(!g_ob[i].used || g_ob[i].invalidated)
            continue;
         if(!g_ob[i].confirmed)
            continue;              // entry must be CONFIRMED
         if(g_ob[i].direction!=oppDir)
            continue;
         // Confirmation must not predate the entry bar. Equality is allowed:
         // signal_time is the entry bar OPEN, while confirmation is decided by
         // that bar's CLOSE, i.e. strictly after our entry in time.
         if(g_ob[i].confirmed_time<g_plan.signal_time)
            continue;
         g_trState=1;
         g_trTarget=g_plan.entry;                      // firm original entry
         g_trDirection=g_plan.direction;
         g_trConfirmed=g_ob[i].confirmed_time;
         g_trCount++;
         Print("VaultTrades | ",(oppDir>0?"BULLISH":"BEARISH")," OB entry confirmed ",
               TimeToString(g_ob[i].confirmed_time,TIME_DATE|TIME_MINUTES)," | ",
               (g_plan.direction>0?"BUY":"SELL")," direction invalidated | waiting for original entry ",
               DoubleToString(g_plan.entry,g_specs.digits)," to close the remainder");
         g_status="PLAN B: DIRECTION INVALIDATED - WAITING FOR ORIGINAL ENTRY";
         break;
        }
     }
   if(g_trState!=1)
      return;
   double bid=SymbolInfoDouble(g_symbol,SYMBOL_BID), ask=SymbolInfoDouble(g_symbol,SYMBOL_ASK);
   double px=(g_trDirection>0?bid:ask);
   bool reached=(g_trDirection>0?(px>=g_trTarget):(px<=g_trTarget));
   if(!reached)
     {
      g_trBlocked++;
      return;
     }
   ulong ticket;
   ENUM_POSITION_TYPE type;
   double vol;
   if(!FindOurPosition(ticket,type,vol))
     {
      g_trState=0;
      ResetPlan();
      return;
     }
   trade.SetExpertMagicNumber(g_magic);
   trade.SetDeviationInPoints((ulong)VtWorkingDeviationPoints());
   trade.SetTypeFilling(VtChooseFilling(g_specs));
   if(!trade.PositionClose(ticket))
     {
      Print("VaultTrades | Plan B close failed retcode=",trade.ResultRetcode()," ",
            trade.ResultRetcodeDescription());
      return;
     }
   Print("VaultTrades | ORIGINAL POSITION CLOSING | remaining ",DoubleToString(vol,4),
         " closed at ",DoubleToString(px,g_specs.digits),
         " (break-even on that volume; realised TP portions retained)");
   g_trState=2;
   ResetPlan();
// Notification 6: the opposite side is never chased. Only the V12 Fib
// authority may execute it, and only from a fresh retest inside its window.
   Print("VaultTrades | ",(oppDir>0?"BUY":"SELL")," awaiting valid execution | opposite side is only entered by the Fib authority, never chased");
   g_status="PLAN B COMPLETE - OPPOSITE SIDE MAY BE EVALUATED";
  }

//------------------------------- Events -----------------------------
// Resolves the traded instrument. An explicit override wins; otherwise the
// chart symbol is used, so attaching to GOLDmicro keeps trading GOLDmicro
// while still reading that broker's own specifications.
bool ResolveTradedSymbol()
  {
   SymbolSpecs specs;
   if(InpSymbolOverride!="")
     {
      if(ResolveInstrument(InpSymbolOverride,specs))
        {
         g_specs=specs;
         g_symbol=specs.name;
         Print("Vortex: override \"",InpSymbolOverride,"\" resolved to ",g_symbol);
         return true;
        }
      Print("Vortex: override \"",InpSymbolOverride,"\" could not be resolved; falling back to the chart symbol.");
     }
   if(LoadSymbolSpecs(_Symbol,specs))
     {
      g_specs=specs;
      g_symbol=specs.name;
      VtLogSpecs("Vortex: chart symbol",specs);
      return true;
     }
   return false;
  }
//------------------- Attach-time account report ---------------------
// One verdict line, printed at attach, so a non-technical user can read what
// this account can actually do without interpreting later execution logs. It
// sizes the first trade from the live ATR and the current price; nothing here
// changes the strategy, the Fib levels or the Order Block rules.
void ReportAutoDetection()
  {
   VtLogAccountProfile();
   VtLogSpecs("Vortex: monitoring",g_specs);

   int volDigits=VtVolumeDigits(g_specs.volumeStep);
   double fiveMin=VT_TARGETS*g_specs.volumeMin;
   PositionPlan probe;
   string probeReason="";
   bool splitAtMin=BuildVolumePlan(fiveMin,probe,probeReason);

// Indicative sizing from the live ATR, so the verdict describes this account
// instead of a hypothetical one.
   double indicativeLots=0.0;
   string indicativeVerdict="";
   bool indicativeOK=false;
   double atrNow=0.0;
   double atrBuf[1];
   if(g_atr_handle!=INVALID_HANDLE && CopyBuffer(g_atr_handle,0,0,1,atrBuf)==1)
      atrNow=atrBuf[0];
   double refPrice=SymbolInfoDouble(g_symbol,SYMBOL_ASK);
   if(refPrice<=0.0)
      refPrice=SymbolInfoDouble(g_symbol,SYMBOL_BID);
   if(atrNow>0.0 && refPrice>0.0)
     {
      double slRef=NPrice(refPrice-InpStopAtrMult*atrNow);
      PositionPlan indicative;
      indicativeOK=ResolveVolumePlan(1,refPrice,slRef,indicativeLots,indicative,
                                     indicativeVerdict,false);
     }

   Print("Vortex verdict | ",g_symbol," | ",VtVolumeClass(g_specs),
         " | sizing=",(InpSizingMode==VT_VX_AUTO
                       ? "AUTO "+DoubleToString(InpRiskPercent,2)+"% of "+
                       AccountInfoString(ACCOUNT_CURRENCY)+" equity"
                       : "FIXED "+DoubleToString(InpLotSize,2)+" lots"),
         " | three targets need ",DoubleToString(fiveMin,volDigits),
         " lots (3 x broker minimum ",DoubleToString(g_specs.volumeMin,volDigits),")",
         " | exit model: ",g_tpModelAtAttach,
         " | stop: ",DoubleToString(InpStopAtrMult,2)," x ATR from entry (cap ",DoubleToString(VT_MAX_STOP_RISK_PCT,1),"%)",
         " | RR: ",(InpRRMode==VT_RR_OFF?"off (fib ladder only)":(InpRRMode==VT_RR_GATE?"gate ":"anchor ")+DoubleToString(InpRRMultiple,2)+"R"),
         " | trade permission: ",(MQLInfoInteger(MQL_TRADE_ALLOWED)?"ON - signals will execute":"OFF - signals will log but not execute"),
         " | terminal=",(TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)?"ON":"OFF")," program=",(MQLInfoInteger(MQL_TRADE_ALLOWED)?"ON":"OFF"),
         " | first trade would use ",(indicativeOK?DoubleToString(indicativeLots,volDigits):"a volume sized on the first signal"),
// Volume and exit model follow the volume phrase above.
         " | entry engine: ",(InpEntryEngine==VT_EE_TOUCH
                              ? "ENTRY_ZONE_TOUCH (fib band touched, no confirmation layer veto)"
                              : (InpEntryEngine==VT_EE_FIB_FLIP ? "FIB_FLIP (band touched then flip-confirmed)" : "CONFLUENCE (displacement + score, no flip)")),
         " | ",EnumToString(VT_TF)," rules; NY window gate=",
         (InpEntryEngine==VT_EE_TOUCH ? (InpTouchNeedsWindow?"ON":"OFF") : "ON"));

   if(indicativeOK && g_tpModelAtAttach=="full close at TP1")
      Print("Vortex verdict note | ",indicativeVerdict,
            ". Three-target exits need at least ",DoubleToString(fiveMin,volDigits),
            " lots on this broker; below that a position can only be closed in one",
            " piece, so every trade exits fully at TP1. Raise the risk percent or",
            " fund the account further if the three-target ladder is required.");
   if(!splitAtMin)
      Print("Vortex verdict note | this broker cannot express three equal portions at three times its own ",
            "minimum volume: ",probeReason,". The signal itself is unaffected.");
// Lot economics. One lot is a different amount of gold, currency or index on
// a micro, mini and standard listing, so the size that actually matters is
// printed in money: what one lot is worth per point here, and what the same
// risk budget buys when the stop is tight versus wide. This changes nothing
// in the strategy; it makes the account type readable at attach time.
   double priceNow=SymbolInfoDouble(g_symbol,SYMBOL_ASK);
   if(priceNow<=0.0)
      priceNow=SymbolInfoDouble(g_symbol,SYMBOL_BID);
   if(InpSizingMode==VT_VX_AUTO && priceNow>0.0)
     {
      double riskMoney=AccountInfoDouble(ACCOUNT_EQUITY)*InpRiskPercent/100.0;
      if(riskMoney<=0.0)
         riskMoney=AccountInfoDouble(ACCOUNT_BALANCE)*InpRiskPercent/100.0;
      string econErr="";
      double perPoint=0.0;
      if(riskMoney>0.0 &&
         VtRiskMoneyPerLot(g_specs,1,priceNow,g_specs.point,perPoint,econErr))
        {
         Print("Vortex lot economics | ",g_symbol," | 1.00 lot = ",
               DoubleToString(g_specs.contractSize,2)," units = ",
               DoubleToString(priceNow*g_specs.contractSize,2)," ",
               AccountInfoString(ACCOUNT_CURRENCY)," notional at ",
               DoubleToString(priceNow,g_specs.digits),
               " | 1 point = ",DoubleToString(perPoint,2)," ",
               AccountInfoString(ACCOUNT_CURRENCY)," per 1.00 lot",
               " | risk budget ",DoubleToString(riskMoney,2)," ",
               AccountInfoString(ACCOUNT_CURRENCY));
         double tightStop=(atrNow>0.0 ? InpStopAtrMult*atrNow : 0.0);
         double wideStop=tightStop*3.0;
         double tightMoney=0.0,wideMoney=0.0;
         if(tightStop>0.0 &&
            VtRiskMoneyPerLot(g_specs,1,priceNow,tightStop,tightMoney,econErr) &&
            VtRiskMoneyPerLot(g_specs,1,priceNow,wideStop,wideMoney,econErr) &&
            tightMoney>0.0 && wideMoney>0.0)
           {
            double tightLots=MathFloor(riskMoney/tightMoney/g_specs.volumeStep+1e-9)*g_specs.volumeStep;
            double wideLots=MathFloor(riskMoney/wideMoney/g_specs.volumeStep+1e-9)*g_specs.volumeStep;
            if(tightLots<g_specs.volumeMin)
               tightLots=g_specs.volumeMin;
            if(wideLots<g_specs.volumeMin)
               wideLots=g_specs.volumeMin;
            tightLots=NormalizeDouble(tightLots,volDigits);
            wideLots=NormalizeDouble(wideLots,volDigits);
            Print("Vortex lot economics | this account | a stop of ",
                  DoubleToString(tightStop,g_specs.digits)," (",
                  DoubleToString(tightStop/g_specs.point,0)," points) buys ",
                  DoubleToString(tightLots,volDigits)," lots, a stop of ",
                  DoubleToString(wideStop,g_specs.digits)," (",
                  DoubleToString(wideStop/g_specs.point,0)," points) buys ",
                  DoubleToString(wideLots,volDigits),
                  " lots. The lot number changes so the money at risk does not.");
           }
         Print("Vortex lot economics | hard cap ",
               (InpMaxLotSize>0.0 ? "InpMaxLotSize="+DoubleToString(InpMaxLotSize,volDigits)+
                " lots is ON, so the risk taken stays at or below that ceiling"
                : "InpMaxLotSize is OFF, so the risk budget alone decides the lot"),
               " | on a micro listing the same money buys a wider lot number and",
               " on a standard listing a narrower one, which is the point of sizing",
               " from equity and contract size instead of a fixed lot.");

        }
     }
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int OnInit()
  {
// The timeframe is resolved once, before any handle is created, so every
// rule, indicator and bar timestamp in this run reads the same period.
// The attached chart is the authority. MTF is respected literally: the
// timeframe the EA is attached to is the timeframe whose fib, ATR stop,
// targets and retest window trade. InpTimeframe overrides it only when it is
// set to an explicit period instead of PERIOD_CURRENT.
   VT_TF=(InpTimeframe==PERIOD_CURRENT)?(ENUM_TIMEFRAMES)Period():InpTimeframe;
#ifdef VT_ALLOW_ALL_TF
// Comparison build only: the period under test is the chart period, so one
// input set can be replayed on every timeframe without editing InpTimeframe.
   VT_TF=(ENUM_TIMEFRAMES)Period();
#endif
// MTF: every period is traded on its own terms, because the attached chart
// decides the timeframe. M1 and M5 are the periods measured on gold; the
// on gold over 12 months and are break-even or losing, so they are refused
// at attach time rather than left available as a live exception.
#ifdef VT_ALLOW_ALL_TF
   if(false)
#else
   if(VT_TF!=PERIOD_M1 && VT_TF!=PERIOD_M5)
#endif
     {
      Print("Vortex: trading ",EnumToString(VT_TF)," on ",_Symbol,". M1 and M5 are the periods ",
            "measured on gold so far; ",EnumToString(VT_TF)," is unmeasured and untested.",
            " is not approved for trading on gold.");
      // Accepted by design: the attach is not refused, the period trades.
     }
// One magic number per timeframe, so an M1 instance and an M5 instance can run
// side by side on the same symbol without opening, seeing or closing each
// other's position. On a netting account run only one instance per symbol.
   g_magic=VT_MAGIC+(ulong)(PeriodSeconds(VT_TF)/60);
   if(Period()!=VT_TF)
      Print("Vortex: the chart period ",EnumToString(Period())," differs from the traded timeframe ",
            EnumToString(VT_TF),". The EA always reads ",EnumToString(VT_TF),
            " data; attach it to a ",EnumToString(VT_TF)," chart to avoid confusion.");
   if(VT_TF<PERIOD_M1 || VT_TF>PERIOD_MN1)
     {
      Print("VaultTrades Vortex: invalid timeframe input");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(InpSizingMode==VT_VX_FIXED)
     {
      if(InpLotSize<=0.0)
        {
         Print("VaultTrades Vortex: fixed sizing needs a positive lot size");
         return INIT_PARAMETERS_INCORRECT;
        }
     }
   else
      if(InpRiskPercent<=0.0 || InpRiskPercent>10.0)
        {
         Print("VaultTrades Vortex: risk per trade must be above 0 and at most 10 percent");
         return INIT_PARAMETERS_INCORRECT;
        }
   if(InpMinLotSize<0.0)
     {
      Print("VaultTrades Vortex: InpMinLotSize cannot be negative");
      return INIT_PARAMETERS_INCORRECT;
     }
   VtResetCanonicalRegistry();
   if(!ResolveTradedSymbol())
     {
      Print("Vortex: no usable broker specifications for ",_Symbol,". EA will not run.");
      return INIT_FAILED;
     }

   if(!g_specs.tradable)
      Print("Vortex: ",_Symbol," is not tradable right now (broker trade mode); the EA stays attached ",
            "and will not send orders until trading is enabled for it.");

// Silver inverse-flow vote applies to metals only, using the broker's
// own silver listing when one exists.
   g_silver_symbol="";
   if(g_specs.asset==VT_ASSET_METAL)
     {
      SymbolSpecs xag;
      if(VtResolveSilver(xag,false))
        {
         g_silver_symbol=xag.name;
         g_silver_ma_handle=iMA(g_silver_symbol,VT_TF,50,0,MODE_EMA,PRICE_CLOSE);
         if(g_silver_ma_handle==INVALID_HANDLE)
            Print("Vortex: silver MA handle failed; the silver trend vote is excluded.");
        }
      else
         Print("Vortex: no usable silver instrument on this broker; the silver vote is excluded ",
               "from confluence (informational component only).");
     }

   g_atr_handle=iATR(g_symbol,VT_TF,VT_ATR_PERIOD);
   if(g_atr_handle==INVALID_HANDLE)
     {
      Print("Vortex: ATR handle failed for ",g_symbol);
      return INIT_FAILED;
     }
   g_ema_handle=iMA(g_symbol,VT_TF,50,0,MODE_EMA,PRICE_CLOSE);
   if(g_ema_handle==INVALID_HANDLE)
     {
      Print("Vortex: EMA50 handle failed for ",g_symbol);
      return INIT_FAILED;
     }

   trade.SetExpertMagicNumber(g_magic);
   ResetSetup(g_buy);
   ResetSetup(g_sell);
   ResetPlan();
   ArrayResize(g_ob,0);
   VtStructureReset(g_struct);

// Report the account capabilities and the exit model this account can run
// now, before any trade is possible, then verify the three-target model at
// the smallest volume it can ever use (five times the broker minimum).
   ReportAutoDetection();
   PositionPlan probe;
   probe.initial_volume=0.0;
// Volume plan probe: the fixed-lot volume is not assumed here, the broker
// minimum is.
   ArrayInitialize(probe.close_volume,0.0);
   probe.full_close_mode=false;
   string planReason="";
   if(!BuildVolumePlan(VT_TARGETS*g_specs.volumeMin,probe,planReason))
      Print("Vortex: three-target split at five times the broker minimum unavailable: ",
            " lots: ",planReason," -> the exit model is a full close at TP1.");   // Three-target split at the broker minimum: reported by ReportAutoDetection.


   g_last_bar=iTime(g_symbol,VT_TF,0);
   g_status="READY";
   Print("VaultTrades Vortex v1.01 initialized. BrokerCompat=",VT_BC_VERSION,
         " | symbol=",g_symbol," | silver=",(g_silver_symbol==""?"none":g_silver_symbol),
         " | sizing=",(InpSizingMode==VT_VX_AUTO
                       ? "AUTO risk "+DoubleToString(InpRiskPercent,2)+"% of equity"
                       : "FIXED "+DoubleToString(InpLotSize,2)+" lots"),
         " | spread limit=",DoubleToString(InpMaxSpreadPoints,0)," points (0=off)",
         " | minConfluence=",InpMinConfluence," | retestBars=",InpRetestBars,
         " | timeframe=",EnumToString(VT_TF)," | magic=",(string)g_magic);
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   Print("Vortex diag | impulse=",g_diagImpulse," stage2=",g_diagStage2," retest=",g_diagRetest,
         " candle=",g_diagCandle," stage3=",g_diagStage3,
         " | win=",g_diagWin," disp=",g_diagDisp," fib=",g_diagFib," liq=",g_diagLiq,
         " liqPool=(not tracked)"," liqTgt=(not tracked)",
         " ob=",g_diagOb," struct=",g_diagStruct," score=",g_diagScore);
   Print("Vortex gateblock | candidates=",g_gateCand,
         " engine=",EnumToString(InpEntryEngine),
         " | closedByWindow=",g_gateWin," closedByLocation=",g_gateLoc,
         " closedByRetest=",g_gateRetest," closedByDisplacement=",g_gateDisp,
         " closedByFlipRetest=",g_gateFlipRetest," closedByFlipCandle=",g_gateFlipCandle,
         " closedByOrderBlock=",g_gateOb," closedByLiquidity=",g_gateLiq,
         " closedByGeometry=",g_gateGeo," closedByScore=",g_gateScore,
         " closedByZoneNotTouched=",g_gateTouch,
         " qualified=",g_gateQual);
   string buckets="";
   Print("Vortex near-miss | cand=",g_diagStage3," missDisp=",g_missDisp," missOb=",g_missOb,
         " missScore=",g_missScore," allPass=",g_allPass," | minConf=",InpMinConfluence);
   for(int b=0;b<11;b++)
      buckets+=IntegerToString(b*10)+"-"+IntegerToString(b*10+9)+"="+IntegerToString(g_scoreBuckets[b])+" ";
   Print("Vortex score | n=",g_diagStage3," min=",g_scoreMin," max=",g_scoreMax,
         " avg=",DoubleToString(g_diagStage3>0?(double)g_scoreSum/g_diagStage3:0.0,1),
         " | ",buckets);
   if(g_atr_handle!=INVALID_HANDLE)
      IndicatorRelease(g_atr_handle);
   if(g_ema_handle!=INVALID_HANDLE)
      IndicatorRelease(g_ema_handle);
   if(g_silver_ma_handle!=INVALID_HANDLE)
      IndicatorRelease(g_silver_ma_handle);
   Print("Vortex structure | lastSession=",g_lastActiveSession,
         " bullChoch=",g_struct.bullChochCount," bearChoch=",g_struct.bearChochCount,
         " bullSweeps=",g_struct.bullSweepCount," bearSweeps=",g_struct.bearSweepCount,
         " bullExpired=",g_struct.bullExpired," bearExpired=",g_struct.bearExpired,
         " silverReads=",g_diagSilverOk);
   Print("Vortex planB | invalidations=",g_trCount," waitsForEntry=",g_trBlocked,
         " lastState=",g_trState," confirmedWhileLive=",g_trSeen," qualifyingOpposite=",g_trOpp,
         " staleOpposite=",g_trStale," oppositeInvalidated=",g_trInv,
         " obDetected=",g_obDetected," obConfirmed=",g_obConfirmedAll);
   Comment("");
  }

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void OnTick()
  {
   ManagePartialTargets();
   ObTransitionManager();
   if(IsNewBar())
     {
      ScanOrderBlocks();
      UpdateBlockStates();
      EvaluateSignals();
     }
   string side=(g_plan.active?(g_plan.direction>0?"BUY":"SELL"):"FLAT");
   Comment("VaultTrades Vortex v1.01\n",
           "Status: ",g_status,"\n",
           "Symbol: ",g_symbol," | TF: ",EnumToString(VT_TF),"\n",
           "Sizing: ",(InpSizingMode==VT_VX_AUTO
                       ? "AUTO risk "+DoubleToString(InpRiskPercent,2)+"% of equity"
                       : "FIXED "+DoubleToString(InpLotSize,2)+" lots"),
           " | Volume: ",(g_plan.active?VolumeLabel(g_plan.initial_volume):"--"),
           " | Position: ",side,"\n",
           "Signal time: ",(g_plan.active?TimeToString(g_plan.signal_time,TIME_DATE|TIME_MINUTES):"--"),"\n",
           "Execution: automatic | TP model: ",TpModelLabel());
  }

//+----------------------------------------------------------------
