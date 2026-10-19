import { createRouter } from "@tanstack/react-router";
import { ErrorPage, NotFoundPage } from "@/components/dhi/ui/status-page";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({ routeTree, defaultErrorComponent: ErrorPage, defaultNotFoundComponent: NotFoundPage });
}
