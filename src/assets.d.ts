// Bun file imports (`with { type: "file" }`) resolve to a path string
declare module "*.ttf" {
  const path: string
  export default path
}
