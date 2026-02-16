import { createTRPCRouter } from "./trpc";

import { adminRouter } from "./admin/router";
import { agentRouter } from "./agent/router";
import { analyticsRouter } from "./analytics/router";
import { catalogRouter } from "./catalog/router";
import { commerceRouter } from "./commerce/router";
import { corporateRouter } from "./corporate/router";
import { deliveryRouter } from "./delivery/router";
import { engagementRouter } from "./engagement/router";
import { ledgerRouter } from "./ledger/router";
import { offlineRouter } from "./offline/router";
import { packageRouter } from "./package/router";
import { preferenceRouter } from "./preference/router";
import { retailerRouter } from "./retailer/router";
import { roomRouter } from "./room/router";
import { sessionRouter } from "./session/router";
import { storageRouter } from "./storage/router";
import { supportRouter } from "./support/router";
import { userRouter } from "./user/router";
import { webhookRouter } from "./webhook/router";

export const appRouter = createTRPCRouter({
  room: roomRouter,
  package: packageRouter,
  commerce: commerceRouter,
  catalog: catalogRouter,
  user: userRouter,
  session: sessionRouter,
  preference: preferenceRouter,
  retailer: retailerRouter,
  delivery: deliveryRouter,
  admin: adminRouter,
  agent: agentRouter,
  corporate: corporateRouter,
  storage: storageRouter,
  support: supportRouter,
  analytics: analyticsRouter,
  engagement: engagementRouter,
  ledger: ledgerRouter,
  offline: offlineRouter,
  webhook: webhookRouter,
});

export type AppRouter = typeof appRouter;
