import { Studio } from "@/components/studio";
import { getConfiguration } from "@/lib/config";
import { isView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  const initialView = isView(parameters.view) ? parameters.view : "connections";
  return <Studio initialConfig={getConfiguration()} initialView={initialView} />;
}
