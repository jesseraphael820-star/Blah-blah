import { LoaderCircle, ScanFace, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { FaceResult } from "@/lib/types";

export function FaceStatusBadge({ face }: { face: FaceResult }) {
  switch (face.status) {
    case "found":
      return (
        <Badge tone="success" data-testid="face-status">
          <ScanFace className="h-3.5 w-3.5" /> Rosto detectado · {Math.round((face.faces[0]?.score ?? 0) * 100)}%
        </Badge>
      );
    case "multiple":
      return (
        <Badge tone="warning" data-testid="face-status">
          <Users className="h-3.5 w-3.5" /> {face.faces.length} rostos detectados
        </Badge>
      );
    case "none":
      return (
        <Badge tone="danger" data-testid="face-status">
          <TriangleAlert className="h-3.5 w-3.5" /> Nenhum rosto detectado
        </Badge>
      );
    case "unavailable":
      return (
        <Badge tone="neutral" data-testid="face-status">
          <TriangleAlert className="h-3.5 w-3.5" /> Detecção indisponível neste navegador
        </Badge>
      );
    default:
      return (
        <Badge tone="brand" data-testid="face-status">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Detectando rosto…
        </Badge>
      );
  }
}
