import type { QueryClient } from "@tanstack/react-query";

export type InvalidatingClient = Pick<QueryClient, "invalidateQueries">;
