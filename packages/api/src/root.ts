import { createTRPCRouter } from "./trpc";

import { adminRouter } from "./admin/router";
import { analyticsRouter } from "./analytics/router";
import { catalogRouter } from "./catalog/router";
import { commerceRouter } from "./commerce/router";
import { deliveryRouter } from "./delivery/router";
import { engagementRouter } from "./engagement/router";
import { ledgerRouter } from "./ledger/router";
import { packageRouter } from "./package/router";
import { retailerRouter } from "./retailer/router";
import { roomRouter } from "./room/router";
import { sessionRouter } from "./session/router";
import { supportRouter } from "./support/router";
import { userRouter } from "./user/router";

export const appRouter = createTRPCRouter({
  room: roomRouter,
  package: packageRouter,
  commerce: commerceRouter,
  catalog: catalogRouter,
  user: userRouter,
  session: sessionRouter,
  retailer: retailerRouter,
  delivery: deliveryRouter,
  admin: adminRouter,
  support: supportRouter,
  analytics: analyticsRouter,
  engagement: engagementRouter,
  ledger: ledgerRouter,
});

export type AppRouter = typeof appRouter;
