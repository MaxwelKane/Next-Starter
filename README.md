<!-- ## Next.js App Router Course - Starter

This is the starter template for the Next.js App Router Course. It contains the starting code for the dashboard application.

For more information, see the [course curriculum](https://nextjs.org/learn) on the Next.js Website. -->

Next JS Tensorwave take home. 

We start with the nextjs dashboard example to quickly get an viable product out. 
[Click for link](https://github.com/vercel/next-learn/tree/main/dashboard/starter-example)

As well, for the charts I used chartjs.

In the interest of time and efficiency, I decided to use a database for the historical prices and only update prices every hour via a cron job.

In a production environment, you would want cached requests using something like redis. As well, you would have a realtime functionality using something like sockets. Much, much more is to be desired here. 

Nonetheless, it works, and in a quick iteration time.