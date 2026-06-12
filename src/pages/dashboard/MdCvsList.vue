<script setup lang="ts">
import { my_fetch } from "@/my_fetch";
import { get_my_mdcvs_query } from "@/queries/get_my_mdcvs.query";
import { remove_pdf_query, upload_pdf_query } from "@/queries/mdcv_pdf.query";
import { put_mdcv_query } from "@/queries/put_mdcv.query";
import { use_auth } from "@/stores/use_auth.store";
import { use_md } from "@/stores/use_md.store";
import { tw } from "@/utils/tw.util";
import ConfirmPopup from "primevue/confirmpopup";
import ToggleSwitch from "primevue/toggleswitch";
import { useConfirm } from "primevue/useconfirm";
import { ref } from "vue";
import { useRouter } from "vue-router";

const auth = use_auth();
const md_store = use_md();
const router = useRouter();
const data = await get_my_mdcvs_query();

// `kind` is not in the generated client until gen-types is re-run; widen
// locally so the template can react to the representation.
type CvItem = (typeof data)[number] & {
  kind?: "md" | "pdf";
  to?: string;
};

const build_link = (d: (typeof data)[number]) => {
  const base = import.meta.env.VITE_API_URL;
  if (d.as_regulary_by_name_username) {
    return `${base}/${d.as_regulary_by_name_username[0]}/${
      d.as_regulary_by_name_username[1]
    }`;
  }
  if (d.as_default_by_username) return `${base}/${d.as_default_by_username}`;
  if (d.as_default_by_user_id) return `${base}/id/${auth.user?._id}`;
  return undefined;
};

const mdcvs = ref<CvItem[]>(data.map((d) => ({ ...d, to: build_link(d) })));

// undefined kind == legacy markdown cv
const cv_kind = (cv: CvItem) => cv.kind ?? "md";
const pdf_busy = ref<number | null>(null);

// one shared picker; the row button that opened it decides where the file goes
const pdf_input = ref<HTMLInputElement | null>(null);
const pdf_target = ref<CvItem | null>(null);

const open_pdf_picker = (target: CvItem) => {
  pdf_target.value = target;
  pdf_input.value?.click();
};

const handle_pdf_picked = async () => {
  const input = pdf_input.value;
  const file = input?.files?.[0];
  if (input) input.value = ""; // allow re-selecting the same file later
  const cv = pdf_target.value;
  pdf_target.value = null;
  if (!file || !cv) return;
  pdf_busy.value = cv._id;
  try {
    await upload_pdf_query(cv._id, file);
    cv.kind = "pdf";
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  } finally {
    pdf_busy.value = null;
  }
};

const handle_remove_pdf = async (cv: CvItem) => {
  pdf_busy.value = cv._id;
  try {
    await remove_pdf_query(cv._id);
    cv.kind = "md";
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  } finally {
    pdf_busy.value = null;
  }
};

const is_default = (cv: (typeof mdcvs.value)[number]) =>
  !!cv.as_default_by_user_id || !!cv.as_default_by_username;

const handle_edit = (cv: CvItem) => {
  // a pdf cv has nothing to edit in the markdown editor; manage its file
  if (cv_kind(cv) === "pdf") {
    router.push(`/pdf-cv?id=${cv._id}`);
    return;
  }
  if (
    md_store.is_dirty &&
    !confirm("Discard your current unsaved changes and edit this CV instead?")
  ) {
    return;
  }
  md_store.load_cv({ _id: cv._id, md: cv.md, css: cv.css, name: cv.name });
  router.push("/md-cv");
};

const handle_delete = async (id: number) => {
  await my_fetch({
    method: "delete",
    path: "/v1/mdcv/:mdcv_id",
    params: { mdcv_id: id },
    res_as: "none",
  });
  mdcvs.value = mdcvs.value.filter((cv) => cv._id !== id);
  if (md_store.edited_mdcv_id === id) md_store.reset();
};

const confirm_popup = useConfirm();

// the switches are display-only; this popup is the single way to flip them,
// so no request fires before the user explicitly confirms
const confirm_toggle = (
  event: MouseEvent,
  message: string,
  accept: () => Promise<void>,
) => {
  confirm_popup.require({
    target: event.currentTarget as HTMLElement,
    message,
    rejectProps: { label: "Cancel", severity: "secondary", outlined: true },
    acceptProps: { label: "Yes" },
    accept: () => {
      accept().catch((err) =>
        alert(err instanceof Error ? err.message : String(err))
      );
    },
  });
};

const toggle_published = async (cv: (typeof mdcvs.value)[number]) => {
  const next = !cv.is_published;
  await put_mdcv_query(cv._id, { is_published: next });
  cv.is_published = next;
};

const toggle_default = async (cv: (typeof mdcvs.value)[number]) => {
  const next = !is_default(cv);
  await my_fetch({
    method: "put",
    path: "/v1/mdcv/:mdcv_id/default",
    params: { mdcv_id: cv._id },
    res_as: "application/json",
    body: { is_default: next },
  });
  // only one default may exist at a time
  mdcvs.value = mdcvs.value.map((c) => ({
    ...c,
    as_default_by_user_id: c._id === cv._id && next
      ? auth.user?._id
      : undefined,
    as_default_by_username: c._id === cv._id && next
      ? auth.user?.nik
      : undefined,
  }));
};
</script>

<template>
  <ConfirmPopup />
  <input
    ref="pdf_input"
    type="file"
    accept="application/pdf"
    :class='tw("hidden")'
    @change="handle_pdf_picked"
  />

  <div :class='tw("mb-4")'>
    <t-btn @click='() => router.push("/pdf-cv")'>New CV from PDF</t-btn>
  </div>

  <ol :class='tw("flex flex-col gap-4")'>
    <li
      v-for="cv of mdcvs"
      :key="cv._id"
      :class='tw("rounded border border-gray-200 p-3")'
    >
      <div :class='tw("flex items-center gap-2")'>
        <t-h :n="4">{{ cv.name || cv.md?.substring(0, 20) || "Untitled" }}</t-h>
        <span
          v-if="is_default(cv)"
          :class='tw("rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700")'
        >default</span>
        <span
          :class='tw("rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-700")'
        >{{ cv_kind(cv) === "pdf" ? "PDF" : "MD" }}</span>
      </div>

      <template v-if="cv.to">
        <t-a :to="cv.to">{{ cv.to }}</t-a>
        <a
          :href="`${cv.to}.pdf`"
          target="_blank"
          rel="noopener"
          :class='tw("ml-2 text-sm underline")'
        >Download PDF</a>
      </template>

      <div :class='tw("mt-2 flex flex-wrap items-center gap-3")'>
        <t-btn @click="() => handle_edit(cv)">Edit</t-btn>
        <t-btn @click="async () => await handle_delete(cv._id)">Delete</t-btn>

        <t-btn
          :disabled="pdf_busy !== null"
          @click="() => open_pdf_picker(cv)"
        >{{
          pdf_busy === cv._id
          ? "Uploading…"
          : cv_kind(cv) === "pdf"
          ? "Replace PDF"
          : "Upload PDF"
        }}</t-btn>
        <t-btn
          v-if='cv_kind(cv) === "pdf"'
          :disabled="pdf_busy !== null"
          @click="async () => await handle_remove_pdf(cv)"
        >Remove PDF</t-btn>

        <div
          :class='tw("flex cursor-pointer items-center gap-2 text-sm")'
          title="Public CVs can be opened by anyone with the link"
          @click='(e) =>
          confirm_toggle(
            e,
            cv.is_published
              ? "Hide this CV? Its public link will stop working."
              : "Publish this CV? Anyone with the link will be able to open it.",
            async () => await toggle_published(cv),
          )'
        >
          <ToggleSwitch
            :model-value="cv.is_published"
            :class='tw("pointer-events-none shrink-0")'
          />
          <span :class='tw("flex flex-col leading-tight")'>
            Published
            <span :class='tw("text-xs text-gray-500")'>
              public link {{ cv.is_published ? "works" : "is off" }}
            </span>
          </span>
        </div>

        <div
          v-if="auth.user?.nik"
          :class='tw("flex cursor-pointer items-center gap-2 text-sm")'
          title="The default CV is served from your plain username link"
          @click='(e) =>
          confirm_toggle(
            e,
            is_default(cv)
              ? "Remove default status from this CV?"
              : "Make this CV your default? It replaces the current default one.",
            async () => await toggle_default(cv),
          )'
        >
          <ToggleSwitch
            :model-value="is_default(cv)"
            :class='tw("pointer-events-none shrink-0")'
          />
          <span :class='tw("flex flex-col leading-tight")'>
            Default
            <span :class='tw("text-xs text-gray-500")'>
              shown at /{{ auth.user?.nik }}
            </span>
          </span>
        </div>
      </div>
    </li>
  </ol>
</template>
