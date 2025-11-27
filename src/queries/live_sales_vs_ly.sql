with sales_by_year_and_time as (

    select
        
        branch,

        datetime_add(datetime(
            extract(year from current_date()),
            extract(month from current_date()),
            extract(day from current_date()),
            hour,
            cast(10 * floor(minute / 10) as int64),
            0
        ), interval 10 minute) ts,

        year,

        count(distinct order_id) num_orders,
        sum(gmv_sek) gmv_sek


    from `fyndiq.leo_data.live_dashboard_base` 

    group by all
)

select

    *

from sales_by_year_and_time
order by ts, year, branch
