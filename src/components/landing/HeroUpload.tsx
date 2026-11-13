"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhotoUploader } from "@/components/upload/PhotoUploader";
import { useStudio } from "@/store/studio";

export function HeroUpload() {
  const router = useRouter();
  const { photo } = useStudio();
  return (
    <PhotoUploader
      footer={
        photo && (
          <Button variant="primary" size="lg" className="w-full" onClick={() => router.push("/studio")} data-testid="open-studio">
            Abrir estúdio de simulação <ArrowRight className="h-5 w-5" />
          </Button>
        )
      }
    />
  );
}
