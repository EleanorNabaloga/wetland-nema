import DailyBriefing from "@/components/DailyBriefing";

export const metadata = {
  title: "Daily Managerial Briefing - NEMA",
  description: "Morning overview of urgent reports, SLA deadlines, hotspots, and officer drafts.",
};

export default function BriefingPage() {
  return (
    <main>
      <DailyBriefing />
    </main>
  );
}
