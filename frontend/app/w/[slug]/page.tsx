import { redirect } from "next/navigation";

export default function WorkspaceIndexPage({ params }: { params: { slug: string } }) {
  redirect(`/w/${params.slug}/upload`);
}
