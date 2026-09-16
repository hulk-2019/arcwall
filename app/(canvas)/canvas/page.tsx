"use client";

import Header from "@/components/header";
import { ProjectList } from "@/components/canvas/ProjectList";

export default function CanvasProjectsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <ProjectList />
      </main>
    </div>
  );
}
