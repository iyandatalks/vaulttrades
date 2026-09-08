# VaultTrades MT5 Execution EA

`VaultTradesExecutionEA.mq5` is the terminal-side worker for the VaultTrades execution queue.

## Architecture

TradingView -> VaultTrades webhook -> Supabase execution queue -> MT5 EA -> demo broker

The EA polls the queue because MT5 Expert Advisors use outbound `WebRequest` calls; the VaultTrades API does not attempt to push into MT5.

## Safe defaults

- `InpExecutionMode = OBSERVE`
- `InpEnableLiveExecution = false`
- `InpDemoOnly = true`
- `InpVolume = 0.01`
- `InpOnlyAttachedSymbol = true`

These defaults prevent the EA from placing a broker order until the operator explicitly changes the execution mode and enables execution. When `InpDemoOnly=true`, LIVE execution is rejected unless the attached MT5 account is a demo account.

## MT5 setup

1. Open MetaEditor and compile `VaultTradesExecutionEA.mq5`.
2. In MT5, open **Tools -> Options -> Expert Advisors**.
3. Enable **Allow WebRequest for listed URL**.
4. Add:
   `https://vaulttrades.vercel.app`
5. Attach the EA to the exact broker symbol used by the queued signal, for example `XAUUSD`.
6. Enter the VaultTrades access key in the EA input. Do not place it in source code or commit it to GitHub.
7. Start with `InpExecutionMode=OBSERVE` and `InpEnableLiveExecution=false`.

## End-to-end test

### Phase 1: OBSERVE

- Send one controlled TradingView webhook with `execution_mode=OBSERVE`.
- Confirm one `scanner_signals` row and one `automated_trader_execution_queue` row.
- The EA claims the queue item and acknowledges it as `observed`.
- Confirm the queue item is terminal and no broker order was placed.

### Phase 2: DEMO execution

- Use an MT5 demo account.
- Set `InpExecutionMode=LIVE`.
- Set `InpEnableLiveExecution=true`.
- Keep `InpDemoOnly=true`.
- Send one controlled signal whose SL and TP are valid for the broker symbol.
- Confirm the EA claims the job, places exactly one demo market order, captures the broker order/deal reference, and acknowledges `executed`.
- Confirm the queue row is terminal with the execution reference.

### Duplicate protection

The TradingView webhook uses `signal_fingerprint` to avoid inserting the same signal twice. The MT5 queue claim uses row locking so only one worker can claim a queued job. The EA acknowledges only the worker that claimed the job.

## Important

This EA is an execution worker, not a strategy generator. It executes only jobs already published by VaultTrades. Strategy validation remains upstream in TradingView/VaultTrades.
