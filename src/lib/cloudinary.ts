export type CloudinaryTransformOptions = {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "limit";
  quality?: string;
  format?: string;
  autoOrient?: boolean;
};

export function cloudinaryTransform(
  url: string,
  {
    width,
    height,
    crop = "fill",
    quality = "q_auto",
    format = "f_auto",
    autoOrient = true,
  }: CloudinaryTransformOptions = {}
) {
  if (!url || !url.includes("/res.cloudinary.com/")) return url;
  const marker = "/image/upload/";
  if (!url.includes(marker)) return url;

  const sizeParts: string[] = [];
  if (width) sizeParts.push(`w_${width}`);
  if (height) sizeParts.push(`h_${height}`);
  if (width || height) sizeParts.push(`c_${crop}`);

  const transform = [format, quality, autoOrient ? "a_auto" : "", ...sizeParts]
    .filter(Boolean)
    .join(",");
  return url.replace(marker, `${marker}${transform}/`);
}
