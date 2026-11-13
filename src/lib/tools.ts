import type { Category, CategoryId, Intensity, ToolOption } from "./types";

const CAP_COLORS = [
  { id: "preto", label: "Preto", prompt: "in solid black", swatch: "#111114" },
  { id: "branco", label: "Branco", prompt: "in off-white", swatch: "#f2f0ea" },
  { id: "bege", label: "Bege", prompt: "in beige / sand color", swatch: "#cbb894" },
  { id: "marinho", label: "Marinho", prompt: "in navy blue", swatch: "#1d2a4d" },
];

export const CATEGORIES: Category[] = [
  {
    id: "pele",
    label: "Pele",
    subtitle: "Skinmaxxing",
    note: "Simulação visual de cuidados com a pele. Não representa resultado garantido de nenhum produto ou tratamento.",
    groups: [
      {
        id: "pele-aparencia",
        title: "Aparência da pele",
        options: [
          {
            id: "pele-uniforme",
            label: "Tom uniforme",
            description: "Simula uma pele com tom mais homogêneo.",
            emoji: "✨",
            scope: "the skin tone evenness only",
            prompt:
              "Make the skin tone look more even and balanced, as if after a consistent skincare routine. Keep the person's natural skin color and undertone exactly the same.",
            intensity: true,
          },
          {
            id: "pele-manchas",
            label: "Reduzir manchas e vermelhidão",
            description: "Reduz visualmente manchas, marcas e vermelhidão.",
            emoji: "🩹",
            scope: "blemishes, dark spots and redness on the skin only",
            prompt:
              "Visually reduce blemishes, acne marks, dark spots and redness on the skin, as a realistic skincare simulation. Do not remove freckles or moles unless they are clearly blemishes, keep natural skin texture and pores.",
            intensity: true,
          },
          {
            id: "pele-hidratada",
            label: "Pele hidratada",
            description: "Aparência de pele mais hidratada e saudável.",
            emoji: "💧",
            scope: "the skin hydration appearance only",
            prompt:
              "Make the skin look well hydrated and healthy, with a subtle natural glow and less dryness or flakiness. Avoid an oily or plastic look.",
            intensity: true,
          },
        ],
      },
      {
        id: "pele-textura",
        title: "Níveis de textura",
        options: [
          {
            id: "textura-natural",
            label: "Textura natural refinada",
            description: "Mantém poros visíveis, só refina irregularidades.",
            emoji: "🔬",
            scope: "fine skin texture only",
            prompt:
              "Slightly refine the skin texture, reducing only small irregularities while keeping all pores and natural micro texture clearly visible.",
          },
          {
            id: "textura-suave",
            label: "Textura suavizada",
            description: "Suavização moderada mantendo realismo.",
            emoji: "🧴",
            scope: "skin texture smoothness only",
            prompt:
              "Moderately smooth the skin texture while keeping pores and natural detail visible. The result must still look like real, unretouched-looking skin.",
          },
          {
            id: "textura-editorial",
            label: "Acabamento editorial",
            description: "Visual de foto profissional retocada com leveza.",
            emoji: "📸",
            scope: "skin finish only",
            prompt:
              "Give the skin a light professional editorial retouch finish like a high-end magazine portrait, but still realistic with visible pores — no airbrushed plastic look.",
          },
        ],
      },
    ],
  },
  {
    id: "cabelo",
    label: "Cabelo",
    subtitle: "Hairmaxxing",
    note: "A IA altera principalmente o cabelo e preserva o rosto original.",
    groups: [
      {
        id: "cabelo-cortes",
        title: "Cortes",
        options: [
          {
            id: "low-fade",
            label: "Low fade",
            description: "Degradê baixo, perto da orelha e nuca.",
            emoji: "💈",
            scope: "the hair only",
            prompt:
              "Give the person a clean low fade haircut: the sides fade from skin/very short starting low, just above the ears, blending into slightly longer hair on top that is neatly styled.",
          },
          {
            id: "mid-fade",
            label: "Mid fade",
            description: "Degradê na altura média da cabeça.",
            emoji: "💈",
            scope: "the hair only",
            prompt:
              "Give the person a sharp mid fade haircut: the fade starts at the middle of the sides of the head, blending into textured medium-short hair on top.",
          },
          {
            id: "french-crop",
            label: "French crop",
            description: "Topo texturizado com franja curta reta.",
            emoji: "✂️",
            scope: "the hair only",
            prompt:
              "Give the person a modern French crop haircut: short textured hair on top pushed forward into a short blunt fringe, with faded short sides.",
          },
          {
            id: "buzz-cut",
            label: "Buzz cut",
            description: "Máquina curta e uniforme.",
            emoji: "🪒",
            scope: "the hair only",
            prompt:
              "Give the person a buzz cut: very short uniform clipper-cut hair all over the head, following the natural hairline exactly.",
          },
        ],
      },
      {
        id: "cabelo-comprimento",
        title: "Comprimento",
        options: [
          {
            id: "cabelo-curto",
            label: "Curto",
            description: "Corte curto clássico e arrumado.",
            emoji: "📏",
            scope: "the hair only",
            prompt: "Give the person a short, neat classic haircut with short tapered sides and slightly longer styled top.",
          },
          {
            id: "cabelo-medio",
            label: "Médio",
            description: "Comprimento médio, cobrindo parte das orelhas.",
            emoji: "📏",
            scope: "the hair only",
            prompt: "Give the person medium-length hair that reaches around the ears, naturally styled with some texture.",
          },
          {
            id: "cabelo-longo",
            label: "Longo",
            description: "Cabelo longo na altura dos ombros.",
            emoji: "📏",
            scope: "the hair only",
            prompt: "Give the person long hair that reaches the shoulders, healthy and naturally styled.",
          },
        ],
      },
      {
        id: "cabelo-textura",
        title: "Textura, volume e penteado",
        options: [
          {
            id: "ondulado",
            label: "Ondulado",
            description: "Ondas naturais e definidas.",
            emoji: "🌊",
            scope: "the hair only",
            prompt: "Make the person's hair wavy with natural, defined, healthy waves, keeping a similar length.",
          },
          {
            id: "cacheado",
            label: "Cacheado",
            description: "Cachos definidos e volumosos.",
            emoji: "🌀",
            scope: "the hair only",
            prompt: "Make the person's hair curly with well-defined, healthy, voluminous curls, keeping a flattering length.",
          },
          {
            id: "volume",
            label: "Mais volume",
            description: "Volume no topo com aparência natural.",
            emoji: "🎈",
            scope: "the hair only",
            prompt: "Add natural-looking volume to the top of the hair, styled upward and slightly back, keeping the current cut and color.",
          },
          {
            id: "slick-back",
            label: "Penteado para trás",
            description: "Slick back com acabamento leve.",
            emoji: "🧊",
            scope: "the hair only",
            prompt: "Style the hair slicked back with a light matte finish, neat and modern.",
          },
          {
            id: "franja-texturizada",
            label: "Franja texturizada",
            description: "Fios para frente com textura bagunçada.",
            emoji: "🌪️",
            scope: "the hair only",
            prompt: "Style the hair forward into a messy textured fringe on the forehead, modern and natural.",
          },
          {
            id: "undercut",
            label: "Undercut",
            description: "Laterais curtas com topo mais longo.",
            emoji: "⚡",
            scope: "the hair only",
            prompt: "Give the person an undercut: very short sides and back with longer hair on top styled back with texture.",
          },
        ],
      },
    ],
  },
  {
    id: "rosto",
    label: "Rosto",
    subtitle: "Facial Appearance",
    note: "Simulações de iluminação, barba e estilo. Nenhuma alteração representa mudança anatômica garantida.",
    groups: [
      {
        id: "rosto-iluminacao",
        title: "Iluminação e sombras",
        options: [
          {
            id: "luz-estudio",
            label: "Luz de estúdio",
            description: "Iluminação suave e profissional.",
            emoji: "💡",
            scope: "the lighting only",
            prompt: "Relight the photo with soft, flattering professional studio portrait lighting (large softbox key light, gentle fill).",
          },
          {
            id: "luz-lateral",
            label: "Luz lateral dramática",
            description: "Estilo Rembrandt, mais contraste.",
            emoji: "🌓",
            scope: "the lighting and shadows only",
            prompt: "Relight the photo with dramatic Rembrandt-style side lighting, with a defined triangle of light on the shadow-side cheek and deeper shadows.",
          },
          {
            id: "luz-golden",
            label: "Golden hour",
            description: "Luz quente de fim de tarde.",
            emoji: "🌅",
            scope: "the lighting and color temperature only",
            prompt: "Relight the photo with warm golden hour sunlight coming from the side, natural and soft.",
          },
          {
            id: "luz-neon",
            label: "Neon / cyber",
            description: "Luz fria roxa e azul.",
            emoji: "🟣",
            scope: "the lighting and color only",
            prompt: "Relight the photo with moody purple and cyan neon rim lighting, cinematic night look.",
          },
        ],
      },
      {
        id: "rosto-barba",
        title: "Estilos de barba (quando aplicável)",
        options: [
          {
            id: "barba-stubble",
            label: "Barba por fazer",
            description: "Stubble curto e uniforme.",
            emoji: "🧔",
            scope: "the facial hair only",
            prompt: "Add a short, even, well-groomed stubble beard (about 3 days of growth) that matches the person's hair color.",
          },
          {
            id: "barba-cheia",
            label: "Barba cheia aparada",
            description: "Barba média, bem desenhada.",
            emoji: "🧔‍♂️",
            scope: "the facial hair only",
            prompt: "Add a full, neatly trimmed medium-length beard with clean cheek and neck lines, matching the person's hair color.",
          },
          {
            id: "barba-cavanhaque",
            label: "Cavanhaque",
            description: "Bigode e queixo, bochechas limpas.",
            emoji: "🥸",
            scope: "the facial hair only",
            prompt: "Add a neatly groomed goatee with a connected mustache, cheeks clean shaven, matching the person's hair color.",
          },
          {
            id: "barba-desenhada",
            label: "Contornos definidos",
            description: "Mantém a barba atual com linhas alinhadas.",
            emoji: "📐",
            scope: "the facial hair edges only",
            prompt: "Keep the existing facial hair but make its cheek and neck lines crisp and well defined, as after a barber line-up. If there is no facial hair, change nothing.",
          },
          {
            id: "barbeado",
            label: "Rosto barbeado",
            description: "Remove a barba existente.",
            emoji: "🪒",
            scope: "the facial hair only",
            prompt: "Show the person clean shaven, removing facial hair naturally with realistic skin underneath.",
          },
        ],
      },
      {
        id: "rosto-contorno",
        title: "Contorno visual e estilo",
        options: [
          {
            id: "contorno-luz",
            label: "Contorno por luz e sombra",
            description: "Realça o contorno com iluminação, sem mudar a anatomia.",
            emoji: "🎭",
            scope: "the lighting and shading only",
            prompt:
              "Enhance the visual definition of the jawline and cheekbones using only lighting and subtle shading (like photographic contour lighting). Do NOT reshape, slim or move any facial feature or bone structure.",
          },
          {
            id: "sobrancelhas",
            label: "Sobrancelhas alinhadas",
            description: "Grooming leve das sobrancelhas.",
            emoji: "〰️",
            scope: "the eyebrows grooming only",
            prompt: "Lightly groom the eyebrows: tidy stray hairs and make them look neat and natural, keeping their original shape, thickness and position.",
          },
          {
            id: "estilo-social",
            label: "Visual social",
            description: "Camisa social e grooming executivo.",
            emoji: "👔",
            scope: "the clothing and grooming only",
            prompt: "Dress the person in a crisp tailored dark blazer with a white dress shirt, neat professional grooming.",
          },
          {
            id: "estilo-street",
            label: "Visual streetwear",
            description: "Moletom oversized moderno.",
            emoji: "🧥",
            scope: "the clothing only",
            prompt: "Dress the person in a modern oversized streetwear hoodie in a neutral color.",
          },
        ],
      },
    ],
  },
  {
    id: "acessorios",
    label: "Acessórios",
    subtitle: "Bonés, óculos e mais",
    note: "Visualize como ficaria usando cada item. Modelos genéricos, sem logotipos de marcas.",
    groups: [
      {
        id: "acessorios-bones",
        title: "Bonés",
        options: [
          {
            id: "bone-smashing",
            label: "Boné Smashing",
            description: "Aba curva, estilo esportivo premium.",
            emoji: "🧢",
            scope: "adding the cap only",
            prompt:
              "Put a premium 'Smashing' style baseball cap on the person's head: structured six-panel crown, pre-curved brim facing forward, small minimal embroidered emblem on the front (no readable text), worn naturally and fitted to the head with realistic shadows on the forehead",
            variants: CAP_COLORS,
          },
          {
            id: "bone-aba-reta",
            label: "Snapback aba reta",
            description: "Aba reta, coroa alta.",
            emoji: "🧢",
            scope: "adding the cap only",
            prompt: "Put a flat-brim snapback cap on the person's head, brim facing forward, plain front without logos, worn naturally",
            variants: CAP_COLORS,
          },
          {
            id: "bone-dad-hat",
            label: "Dad hat",
            description: "Boné desestruturado e casual.",
            emoji: "🧢",
            scope: "adding the cap only",
            prompt: "Put an unstructured washed cotton dad hat with a curved brim on the person's head, plain front without logos, worn naturally",
            variants: CAP_COLORS,
          },
          {
            id: "bone-trucker",
            label: "Trucker",
            description: "Frente sólida e tela atrás.",
            emoji: "🧢",
            scope: "adding the cap only",
            prompt: "Put a trucker cap with a foam front panel and mesh back on the person's head, plain front without logos, worn naturally",
            variants: CAP_COLORS,
          },
          {
            id: "gorro",
            label: "Gorro (beanie)",
            description: "Gorro de malha canelado.",
            emoji: "🧶",
            scope: "adding the beanie only",
            prompt: "Put a ribbed knit beanie on the person's head, worn naturally, plain without logos",
            variants: CAP_COLORS,
          },
          {
            id: "bucket",
            label: "Bucket hat",
            description: "Chapéu bucket casual.",
            emoji: "👒",
            scope: "adding the hat only",
            prompt: "Put a cotton bucket hat on the person's head, worn naturally, plain without logos",
            variants: CAP_COLORS,
          },
        ],
      },
      {
        id: "acessorios-oculos",
        title: "Óculos",
        options: [
          {
            id: "oculos-aviador",
            label: "Aviador",
            description: "Armação metálica, lentes degradê.",
            emoji: "🕶️",
            scope: "adding the glasses only",
            prompt: "Put classic gold metal aviator sunglasses with gradient lenses on the person, sitting naturally on the nose and ears",
          },
          {
            id: "oculos-wayfarer",
            label: "Wayfarer escuro",
            description: "Acetato preto, lentes escuras.",
            emoji: "🕶️",
            scope: "adding the glasses only",
            prompt: "Put black acetate wayfarer-style sunglasses with dark lenses on the person, sitting naturally on the nose and ears",
          },
          {
            id: "oculos-redondo",
            label: "Redondo de grau",
            description: "Armação fina redonda, lentes claras.",
            emoji: "👓",
            scope: "adding the glasses only",
            prompt: "Put thin round metal prescription eyeglasses with clear lenses on the person, eyes fully visible through the lenses",
          },
          {
            id: "oculos-retangular",
            label: "Retangular moderno",
            description: "Armação retangular, lentes claras.",
            emoji: "👓",
            scope: "adding the glasses only",
            prompt: "Put modern rectangular black acetate eyeglasses with clear lenses on the person, eyes fully visible through the lenses",
          },
        ],
      },
      {
        id: "acessorios-outros",
        title: "Outros estilos",
        options: [
          {
            id: "corrente",
            label: "Corrente prata",
            description: "Corrente fina no pescoço.",
            emoji: "⛓️",
            scope: "adding the necklace only",
            prompt: "Add a thin silver chain necklace around the person's neck, visible and realistic",
          },
          {
            id: "brinco",
            label: "Brinco argola",
            description: "Argola pequena prateada.",
            emoji: "💍",
            scope: "adding the earring only",
            prompt: "Add a small silver hoop earring on the visible ear, subtle and realistic",
          },
          {
            id: "headphone",
            label: "Headphone",
            description: "Fone over-ear no pescoço.",
            emoji: "🎧",
            scope: "adding the headphones only",
            prompt: "Add modern over-ear headphones resting around the person's neck, plain without logos",
          },
        ],
      },
    ],
  },
  {
    id: "guasha",
    label: "Gua Sha",
    subtitle: "Ferramenta educativa",
    note: "Gua Sha não altera permanentemente a estrutura óssea do rosto.",
    groups: [
      {
        id: "guasha-sim",
        title: "Simulação com IA",
        options: [
          {
            id: "guasha-usando",
            label: "Eu usando Gua Sha de aço",
            description: "Visualize-se segurando a ferramenta na bochecha.",
            emoji: "🪨",
            scope: "adding the gua sha tool and the hand holding it only",
            prompt:
              "Show the person gently holding a polished stainless steel gua sha tool flat against their cheekbone with one hand, as in a skincare routine. The tool is a smooth, mirror-finish steel plate with curved edges",
          },
        ],
      },
    ],
  },
];

export const INTENSITY_LABELS: Record<Intensity, string> = {
  sutil: "Sutil",
  moderado: "Moderado",
  forte: "Forte",
};

const INTENSITY_PROMPTS: Record<Intensity, string> = {
  sutil: "Apply the change very subtly (about 30% strength) so it looks completely natural.",
  moderado: "Apply the change at a moderate, natural-looking strength.",
  forte: "Apply the change clearly visible but still realistic and believable.",
};

export interface ResolvedTool {
  option: ToolOption;
  categoryId: CategoryId;
}

const TOOL_INDEX: Map<string, ResolvedTool> = new Map();
for (const cat of CATEGORIES) {
  for (const group of cat.groups) {
    for (const option of group.options) {
      TOOL_INDEX.set(option.id, { option, categoryId: cat.id });
    }
  }
}

export function getTool(toolId: string): ResolvedTool | undefined {
  return TOOL_INDEX.get(toolId);
}

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id)!;
}

export function describeEdit(toolId: string, variantId?: string, intensity?: Intensity): string {
  const tool = getTool(toolId);
  if (!tool) return "Edição";
  const variant = tool.option.variants?.find((v) => v.id === variantId);
  const parts = [tool.option.label];
  if (variant) parts.push(variant.label);
  if (tool.option.intensity && intensity) parts.push(INTENSITY_LABELS[intensity]);
  return parts.join(" · ");
}

/**
 * Monta o prompt final no servidor. O cliente nunca envia texto livre: apenas
 * ids validados contra este catálogo — evita injeção de prompt e uso indevido.
 */
export function buildPrompt(toolId: string, variantId?: string, intensity?: Intensity): string | null {
  const tool = getTool(toolId);
  if (!tool) return null;
  const { option } = tool;
  let task = option.prompt;
  if (option.variants?.length) {
    const variant = option.variants.find((v) => v.id === variantId) ?? option.variants[0];
    task = `${task}, ${variant.prompt}.`;
  } else if (!/[.!]$/.test(task)) {
    task += ".";
  }
  if (option.intensity) task += " " + INTENSITY_PROMPTS[intensity ?? "moderado"];

  return [
    "Edit this photograph of a real person.",
    `TASK: ${task}`,
    `SCOPE: change ONLY ${option.scope}. Everything else must stay pixel-faithful to the original.`,
    "IDENTITY PRESERVATION (mandatory): it must be the exact same, instantly recognizable person — identical face shape, bone structure, jawline, eye shape and eye color, nose, lips, ears, eyebrows, skin tone, age, gender presentation, expression and head pose.",
    "Do NOT beautify, slim, reshape, de-age or idealize the face or body. Do not alter anatomy. Do not modify any feature that was not requested.",
    "Keep the same background, clothing (unless the task is about clothing), framing, camera angle, image composition and photographic style.",
    "Output a photorealistic image with natural skin texture and pores, consistent lighting and shadows, no artifacts, no text, no watermark, no logos.",
  ].join("\n");
}
