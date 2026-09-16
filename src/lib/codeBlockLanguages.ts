import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import dart from "react-syntax-highlighter/dist/esm/languages/prism/dart";
import diff from "react-syntax-highlighter/dist/esm/languages/prism/diff";
import docker from "react-syntax-highlighter/dist/esm/languages/prism/docker";
import elixir from "react-syntax-highlighter/dist/esm/languages/prism/elixir";
import erlang from "react-syntax-highlighter/dist/esm/languages/prism/erlang";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import graphql from "react-syntax-highlighter/dist/esm/languages/prism/graphql";
import groovy from "react-syntax-highlighter/dist/esm/languages/prism/groovy";
import hcl from "react-syntax-highlighter/dist/esm/languages/prism/hcl";
import ini from "react-syntax-highlighter/dist/esm/languages/prism/ini";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin";
import less from "react-syntax-highlighter/dist/esm/languages/prism/less";
import lua from "react-syntax-highlighter/dist/esm/languages/prism/lua";
import makefile from "react-syntax-highlighter/dist/esm/languages/prism/makefile";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import nginx from "react-syntax-highlighter/dist/esm/languages/prism/nginx";
import perl from "react-syntax-highlighter/dist/esm/languages/prism/perl";
import php from "react-syntax-highlighter/dist/esm/languages/prism/php";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import r from "react-syntax-highlighter/dist/esm/languages/prism/r";
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import sass from "react-syntax-highlighter/dist/esm/languages/prism/sass";
import scala from "react-syntax-highlighter/dist/esm/languages/prism/scala";
import scss from "react-syntax-highlighter/dist/esm/languages/prism/scss";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift";
import toml from "react-syntax-highlighter/dist/esm/languages/prism/toml";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";

const REGISTERED = new Set<string>();

function register(id: string, language: unknown) {
  if (REGISTERED.has(id)) {
    return;
  }
  SyntaxHighlighter.registerLanguage(id, language);
  REGISTERED.add(id);
}

register("bash", bash);
register("c", c);
register("cpp", cpp);
register("csharp", csharp);
register("css", css);
register("dart", dart);
register("diff", diff);
register("docker", docker);
register("elixir", elixir);
register("erlang", erlang);
register("go", go);
register("graphql", graphql);
register("groovy", groovy);
register("hcl", hcl);
register("ini", ini);
register("java", java);
register("javascript", javascript);
register("json", json);
register("jsx", jsx);
register("kotlin", kotlin);
register("less", less);
register("lua", lua);
register("makefile", makefile);
register("markdown", markdown);
register("markup", markup);
register("nginx", nginx);
register("perl", perl);
register("php", php);
register("python", python);
register("r", r);
register("ruby", ruby);
register("rust", rust);
register("sass", sass);
register("scala", scala);
register("scss", scss);
register("sql", sql);
register("swift", swift);
register("toml", toml);
register("tsx", tsx);
register("typescript", typescript);
register("yaml", yaml);

export function isHighlightLanguageSupported(language: string): boolean {
  return REGISTERED.has(language);
}

export { SyntaxHighlighter as PrismSyntaxHighlighter };
