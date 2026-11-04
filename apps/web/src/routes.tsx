import type { RouteObject } from "react-router";
import { EntryPage } from "./pages/entry";
import { NotFoundPage } from "./pages/not-found";
import { SavePage } from "./pages/save";

export const routes: RouteObject[] = [
  { path: "/", element: <EntryPage /> },
  { path: "/save", element: <SavePage /> },
  { path: "*", element: <NotFoundPage /> },
];
