-- Signal Tab automation is intentionally limited to the two independent
-- automation-specific strategy copies. Existing user configuration that
-- selected the former Analyzer IDs is migrated to the new automation IDs.

update scanner_automation.configs
set enabled_strategies = array(
  select distinct mapped_strategy
  from unnest(enabled_strategies) as selected_strategy
  cross join lateral (
    select case selected_strategy
      when 'adaptiveExecution' then 'adaptiveAutomated'
      when 'ema20' then 'emaAutomated'
      when 'adaptiveAutomated' then 'adaptiveAutomated'
      when 'emaAutomated' then 'emaAutomated'
      else null
    end as mapped_strategy
  ) mapping
  where mapped_strategy is not null
),
updated_at = now()
where enabled_strategies && array['adaptiveExecution','ema20','adaptiveAutomated','emaAutomated']::text[];
