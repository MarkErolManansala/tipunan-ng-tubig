-- Latest-reading-per-dam view for the public read surface.
--
-- The home page lists every dam with its most recent reading. `distinct on`
-- with the existing `dam_readings_dam_recent_idx (dam_id, observed_at desc)`
-- index makes this a cheap per-dam "newest row" lookup. The unique constraint
-- on (dam_id, observed_at) guarantees no ties, so the ordering is total.
--
-- `security_invoker = true` makes the view run with the querying role's
-- privileges, so the RLS policies on `dam_readings` (public select) govern
-- access — no separate policy is needed for the view.
--
-- After applying this migration, regenerate `types/database.types.ts`
-- (`supabase gen types typescript --linked`) so the view appears in the
-- generated `Views` section.

create view public.latest_dam_readings
with (security_invoker = true) as
select distinct on (dam_id)
  dam_id,
  observed_at,
  level_m,
  rule_curve_m,
  normal_high_m,
  change_24h_m,
  source
from public.dam_readings
order by dam_id, observed_at desc;
