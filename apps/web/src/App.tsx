import { useRoutes } from "react-router";
import { routes } from "./routes";

export function App() {
  return <main className="mx-auto min-h-dvh w-full max-w-[480px]">{useRoutes(routes)}</main>;
}
