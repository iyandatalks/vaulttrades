# VaultTrades MT5 Execution Bridge

## Connection flow

TradingView Strategy Alert
-> `POST /api/execution/tradingview`
-> VaultTrades execution queue
-> `POST /api/execution/mt5/poll`
-> `VaultTradesExecutionEA` on MT5
-> broker execution (LIVE only when deliberately enabled)
-> `POST /api/execution/mt5/ack`

## MT5 EA attachment checklist

1. Compile `mt5/VaultTradesExecutionEA.mq5` in MetaEditor.
2. Attach `VaultTradesExecutionEA` to the MT5 chart for the broker symbol that should execute the trade (for example `GOLD` if the broker does not use `XAUUSD`).
3. In MT5, enable Algo Trading.
4. In **Tools -> Options -> Expert Advisors**, enable **Allow WebRequest for listed URL** and add:
   `https://vaulttrades.vercel.app`
5. Configure the EA inputs:
   - `InpVaultTradesBaseUrl`: `https://vaulttrades.vercel.app`
   - `InpAccessKey`: the user's VaultTrades execution access key
   - `InpWorkerId`: `mt5-ea`
   - `InpPollSeconds`: `5`
   - `InpExecutionMode`: `OBSERVE` for testing; `LIVE` only when intentionally enabling execution
   - `InpEnableLiveExecution`: `false` during testing; set `true` only for deliberate live execution
   - `InpVolume`: broker/account-approved lot size
   - `InpDeviationPoints`: `30` by default, adjust only when required
   - `InpOnlyAttachedSymbol`: `true` is recommended
   - `InpSymbolMap`: use a mapping when TradingView and the broker use different symbol names, e.g. `XAUUSD=GOLD`

## TradingView webhook

TradingView alerts must send JSON to:

`https://vaulttrades.vercel.app/api/execution/tradingview`

Required signal fields are:

- `access_key`
- `symbol`
- `direction` (`BUY` or `SELL`)
- `entry`
- `stop_loss`
- `tp1`

Optional fields include `timeframe`, `strategy_id`, `strategy_name`, `tp2`, `tp3`, `tp4`, `confidence`, `rr`, `signal_id`, `signal_fingerprint`, `confirmation_conditions`, `missing_conditions`, and `execution_mode`.

Use `execution_mode: OBSERVE` while validating the connection. Use `execution_mode: LIVE` only when the MT5 EA also has `InpExecutionMode=LIVE` and `InpEnableLiveExecution=true`.

## Important symbol note

TradingView commonly identifies gold as `XAUUSD`, while brokers may expose the same instrument as `GOLD`, `XAUUSDm`, `XAUUSD.a`, or another broker-specific symbol. The EA therefore supports `InpSymbolMap`. The order is always sent to the symbol on the chart where the EA is attached.

## Important security note

The VaultTrades Access Key is an authentication credential. It should only be entered in the authenticated VaultTrades/EA configuration workflow and should not be published in screenshots, public Pine code, or public documentation. The current webhook contract uses the Access Key to associate TradingView signals with the correct VaultTrades account.

## OBSERVE test

The first test should be:

1. TradingView sends an alert.
2. VaultTrades creates the signal and execution-queue item.
3. MT5 EA polls every 5 seconds.
4. EA claims the queued job.
5. EA logs the signal and sends `observed` acknowledgement.
6. No broker order is opened.

Only after this complete path works should LIVE execution be tested.
