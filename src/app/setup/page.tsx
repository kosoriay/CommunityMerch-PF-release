import { getOrCreateConfig } from "@/lib/platform-config"
import { redirect } from "next/navigation"

export default async function SetupIndexPage() {
  const config = await getOrCreateConfig()
  redirect(`/setup/step/${config.currentStep}`)
}
