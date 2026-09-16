const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  md: "markdown",
  mdx: "markdown",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  vue: "markup",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  sql: "sql",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  php: "php",
  rb: "ruby",
  swift: "swift",
  cs: "csharp",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "cpp",
  hpp: "cpp",
  c: "c",
  dockerfile: "docker",
  env: "bash",
  ini: "ini",
  conf: "nginx",
  nginx: "nginx",
  graphql: "graphql",
  gql: "graphql",
  diff: "diff",
  patch: "diff",
  prisma: "sql",
  tf: "hcl",
  hcl: "hcl",
  lua: "lua",
  r: "r",
  pl: "perl",
  pm: "perl",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  dart: "dart",
  scala: "scala",
  groovy: "groovy",
  makefile: "makefile",
};

const BASENAME_LANGUAGE: Record<string, string> = {
  dockerfile: "docker",
  makefile: "makefile",
  "docker-compose.yml": "yaml",
  "docker-compose.yaml": "yaml",
};

export function getHighlightLanguage(filename: string): string | null {
  const base = (filename.split("/").pop() ?? filename).toLowerCase();
  const basenameMatch = BASENAME_LANGUAGE[base];
  if (basenameMatch) {
    return basenameMatch;
  }

  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0) {
    return null;
  }

  const ext = base.slice(dotIndex + 1);
  return EXTENSION_LANGUAGE[ext] ?? null;
}

export function getHighlightLanguageLabel(language: string | null): string | null {
  if (!language) {
    return null;
  }
  return language.toUpperCase();
}
