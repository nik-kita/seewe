<script setup lang="ts">
import { get_mdcv_query } from "@/queries/get_mdcv.query";
import { remove_pdf_query, upload_pdf_query } from "@/queries/mdcv_pdf.query";
import { post_mdcv_query } from "@/queries/post_mdcv.query";
import { put_mdcv_query } from "@/queries/put_mdcv.query";
import { use_auth } from "@/stores/use_auth.store";
import { tw } from "@/utils/tw.util";
import { FormKit } from "@formkit/vue";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const auth = use_auth();
const route = useRoute();
const router = useRouter();
const toast = useToast();

// /pdf-cv          -> create a new pdf cv
// /pdf-cv?id=<...> -> manage the pdf of an existing cv (replace, rename, remove)
const mdcv_id = computed(() => {
  const raw = Number(route.query.id);
  return Number.isInteger(raw) && raw > 0 ? raw : undefined;
});

type Existing = Awaited<ReturnType<typeof get_mdcv_query>> & {
  kind?: "md" | "pdf";
};

const existing = ref<Existing | null>(null);
const loading = ref(!!mdcv_id.value);
const name = ref("");
const file = ref<File | null>(null);
const busy = ref(false);

onMounted(async () => {
  if (!mdcv_id.value) return;
  try {
    existing.value = await get_mdcv_query(mdcv_id.value);
    name.value = existing.value.name ?? "";
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "CV not found",
      detail: String(err),
      life: 3000,
    });
    router.push("/dashboard");
  } finally {
    loading.value = false;
  }
});

const file_input = ref<HTMLInputElement | null>(null);

const handle_file_picked = () => {
  const picked = file_input.value?.files?.[0];
  if (!picked) return;
  file.value = picked;
  // default the name from the file once; the user can still change it
  if (!existing.value && !name.value) {
    name.value = picked.name.replace(/\.pdf$/i, "");
  }
};

const can_submit = computed(() => {
  if (busy.value) return false;
  if (existing.value) {
    // something must change: a new file or a new name
    return !!file.value ||
      (!!auth.user?.nik && name.value !== (existing.value.name ?? ""));
  }
  // creating: file always required; name required for users with a username
  return !!file.value && (!auth.user?.nik || !!name.value);
});

const submit = async () => {
  busy.value = true;
  try {
    if (existing.value) {
      if (auth.user?.nik && name.value !== (existing.value.name ?? "")) {
        const res = await put_mdcv_query(existing.value._id, {
          name: name.value,
        });
        if (!res.ok) throw new Error("Rename failed (name already taken?)");
      }
      if (file.value) {
        await upload_pdf_query(existing.value._id, file.value);
      }
    } else {
      if (!file.value) return;
      const res = await post_mdcv_query({
        name: auth.user?.nik ? name.value : undefined,
        md: "",
        is_published: true,
        make_default: !auth.user?.nik,
      });
      await upload_pdf_query(res._id, file.value);
    }
    toast.add({
      severity: "success",
      summary: "Saved",
      detail: existing.value ? "CV updated" : "PDF CV created",
      life: 2000,
    });
    router.push("/dashboard");
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Saving failed",
      detail: err instanceof Error ? err.message : String(err),
      life: 4000,
    });
  } finally {
    busy.value = false;
  }
};

const remove_pdf = async () => {
  if (!existing.value) return;
  if (!confirm("Remove the PDF? The CV reverts to its markdown content.")) {
    return;
  }
  busy.value = true;
  try {
    await remove_pdf_query(existing.value._id);
    existing.value.kind = "md";
    toast.add({
      severity: "success",
      summary: "PDF removed",
      detail: "The CV is served from markdown again",
      life: 2000,
    });
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Removing failed",
      detail: err instanceof Error ? err.message : String(err),
      life: 4000,
    });
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <t-h>{{ existing ? "PDF of your CV" : "New CV from PDF" }}</t-h>

  <t-h v-if="loading" :n="4">loading...</t-h>

  <div v-else :class='tw("flex max-w-xl flex-col gap-4")'>
    <div
      v-if="existing"
      :class='tw("rounded border border-sky-300 bg-sky-50 p-2 text-sm")'
    >
      Managing CV
      <strong>{{ existing.name || `#${existing._id}` }}</strong> — currently
      served as
      <strong>{{
        (existing.kind ?? "md") === "pdf" ? "PDF" : "markdown"
      }}</strong>.
      <span v-if='(existing.kind ?? "md") === "md"'>
        Uploading a PDF here switches it to the PDF representation (the markdown
        is kept).
      </span>
    </div>
    <p v-else :class='tw("text-sm text-gray-600")'>
      Upload a PDF file and it becomes a CV of its own: the public link shows
      the file inline, the
      <code>.pdf</code> link downloads it.
    </p>

    <input
      ref="file_input"
      type="file"
      accept="application/pdf"
      :class='tw("hidden")'
      @change="handle_file_picked"
    />
    <div :class='tw("flex items-center gap-3")'>
      <Button
        icon="pi pi-file-arrow-up"
        icon-pos="left"
        severity="secondary"
        :label='file ? "Choose another file" : "Choose PDF file"'
        @click="() => file_input?.click()"
      />
      <span v-if="file" :class='tw("text-sm")'>
        {{ file.name }} ({{ (file.size / 1024 / 1024).toFixed(2) }} MB)
      </span>
    </div>

    <FormKit
      v-if="auth.user?.nik"
      type="text"
      label="CV name"
      help="Also used in the public link: /username/name"
      v-model="name"
    />
    <p v-else :class='tw("text-sm italic text-gray-600")'>
      Your account has no username, so this CV gets an auto-generated id link
      and becomes your default CV.
    </p>

    <div :class='tw("flex flex-wrap gap-3")'>
      <Button
        :label='existing ? "Save changes" : "Create CV"'
        icon="pi pi-check"
        icon-pos="left"
        :loading="busy"
        :disabled="!can_submit"
        @click="submit"
      />
      <Button
        v-if='existing && (existing.kind ?? "md") === "pdf"'
        label="Remove PDF"
        icon="pi pi-trash"
        icon-pos="left"
        severity="danger"
        outlined
        :disabled="busy"
        @click="remove_pdf"
      />
      <Button
        label="Back to dashboard"
        severity="secondary"
        text
        @click='() => router.push("/dashboard")'
      />
    </div>
  </div>
</template>
