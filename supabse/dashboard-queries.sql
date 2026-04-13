-- ============================================================
-- Vehicle Maintenance Logger — SQL Dashboard
-- Run any of these in Supabase → SQL Editor → New Query
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- QUERY 1: Vehicle Summary
-- Quick overview of both vehicles
-- ────────────────────────────────────────────────────────────
select
  v.name,
  v.make,
  v.model,
  v.year,
  v.current_mileage,
  count(distinct m.id) as total_maintenance_logs,
  count(distinct f.id) as total_fuel_logs,
  coalesce(sum(m.cost), 0) as total_maintenance_cost,
  coalesce(sum(f.total_cost), 0) as total_fuel_cost,
  coalesce(sum(m.cost), 0) + coalesce(sum(f.total_cost), 0) as total_cost_all_time
from vehicles v
left join maintenance_logs m on m.vehicle_id = v.id
left join fuel_logs f on f.vehicle_id = v.id
group by v.id, v.name, v.make, v.model, v.year, v.current_mileage
order by v.created_at;


-- ────────────────────────────────────────────────────────────
-- QUERY 2: Miles Since Last Oil Change
-- Critical for knowing when you're due
-- ────────────────────────────────────────────────────────────
with last_oil as (
  select distinct on (vehicle_id)
    vehicle_id,
    mileage as oil_change_mileage,
    logged_at as oil_change_date,
    cost as oil_change_cost
  from maintenance_logs
  where category = 'oil_change'
  order by vehicle_id, logged_at desc
)
select
  v.name as vehicle,
  v.current_mileage,
  lo.oil_change_mileage,
  lo.oil_change_date::date as last_oil_change,
  lo.oil_change_cost,
  v.current_mileage - lo.oil_change_mileage as miles_since_oil_change,
  case
    when v.current_mileage - lo.oil_change_mileage > 4500 then 'OVERDUE'
    when v.current_mileage - lo.oil_change_mileage > 3500 then 'DUE SOON'
    else 'OK'
  end as oil_status
from vehicles v
left join last_oil lo on lo.vehicle_id = v.id
order by v.created_at;


-- ────────────────────────────────────────────────────────────
-- QUERY 3: Total Cost Per Vehicle Per Year
-- ────────────────────────────────────────────────────────────
select
  v.name as vehicle,
  extract(year from m.logged_at) as year,
  count(*) as service_count,
  sum(m.cost) as total_cost,
  round(avg(m.cost), 2) as avg_cost_per_service
from maintenance_logs m
join vehicles v on v.id = m.vehicle_id
where m.cost is not null
group by v.name, extract(year from m.logged_at)
order by v.name, year desc;


-- ────────────────────────────────────────────────────────────
-- QUERY 4: Average MPG Trend (last 10 fill-ups per vehicle)
-- ────────────────────────────────────────────────────────────
select
  vehicle_name,
  logged_at::date as fill_date,
  mileage,
  gallons,
  miles_since_last,
  mpg,
  round(avg(mpg) over (
    partition by vehicle_id
    order by logged_at
    rows between 4 preceding and current row
  ), 1) as rolling_avg_mpg
from fuel_economy
where mpg is not null
order by vehicle_name, logged_at desc
limit 20;


-- ────────────────────────────────────────────────────────────
-- QUERY 5: Full Service History Timeline
-- Everything in chronological order for both vehicles
-- ────────────────────────────────────────────────────────────
select
  v.name as vehicle,
  'maintenance' as type,
  m.category,
  m.description,
  m.mileage,
  m.cost,
  m.shop_name,
  m.logged_at::date as date,
  m.notes
from maintenance_logs m
join vehicles v on v.id = m.vehicle_id
union all
select
  v.name as vehicle,
  'fuel' as type,
  'fuel_stop' as category,
  concat(coalesce(m.gallons::text, '?'), ' gal @ $', coalesce(m.price_per_gallon::text, '?'), '/gal') as description,
  m.mileage,
  m.total_cost as cost,
  m.station_name as shop_name,
  m.logged_at::date as date,
  m.notes
from fuel_logs m
join vehicles v on v.id = m.vehicle_id
order by date desc, vehicle;


-- ────────────────────────────────────────────────────────────
-- QUERY 6: Upcoming Service Reminders
-- Based on next_service_mileage set during logging
-- ────────────────────────────────────────────────────────────
select
  v.name as vehicle,
  v.current_mileage,
  m.category,
  m.description,
  m.next_service_mileage,
  m.next_service_date,
  m.next_service_mileage - v.current_mileage as miles_until_service,
  case
    when m.next_service_date < current_date then 'DATE OVERDUE'
    when m.next_service_mileage - v.current_mileage < 0 then 'MILEAGE OVERDUE'
    when m.next_service_mileage - v.current_mileage < 500 then 'DUE VERY SOON'
    when m.next_service_mileage - v.current_mileage < 1500 then 'DUE SOON'
    else 'UPCOMING'
  end as status
from maintenance_logs m
join vehicles v on v.id = m.vehicle_id
where m.next_service_mileage is not null
   or m.next_service_date is not null
order by v.name, m.next_service_mileage asc nulls last;


-- ────────────────────────────────────────────────────────────
-- QUERY 7: Cost Breakdown by Category
-- Where is your money going?
-- ────────────────────────────────────────────────────────────
select
  v.name as vehicle,
  m.category,
  count(*) as times_serviced,
  sum(m.cost) as total_spent,
  round(avg(m.cost), 2) as avg_cost,
  min(m.cost) as min_cost,
  max(m.cost) as max_cost
from maintenance_logs m
join vehicles v on v.id = m.vehicle_id
where m.cost is not null
group by v.name, m.category
order by v.name, total_spent desc;


-- ────────────────────────────────────────────────────────────
-- QUERY 8: Fuel Cost Trend (monthly)
-- ────────────────────────────────────────────────────────────
select
  v.name as vehicle,
  to_char(f.logged_at, 'YYYY-MM') as month,
  count(*) as fill_ups,
  sum(f.gallons) as total_gallons,
  sum(f.total_cost) as total_fuel_cost,
  round(avg(f.price_per_gallon), 3) as avg_price_per_gallon
from fuel_logs f
join vehicles v on v.id = f.vehicle_id
where f.total_cost is not null
group by v.name, to_char(f.logged_at, 'YYYY-MM')
order by v.name, month desc;
