import { Inngest } from "inngest";
import prisma from "../config/prisma.js";

export const inngest = new Inngest({ id: "Project-Management" });

const syncUserCreation = inngest.createFunction(
  { id: "Sync-user-from-clerk", event: "clerk/user.created" },
  async ({ event }) => {
    const { data } = event;
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

    await prisma.user.upsert({
      where: { id: data.id },
      update: {
        email: data?.email_addresses?.[0]?.email_address ?? "",
        name: fullName,
        image: data.profile_image_url ?? data.image_url ?? null,
      },
      create: {
        id: data.id,
        email: data?.email_addresses?.[0]?.email_address ?? "",
        name: fullName,
        image: data.profile_image_url ?? data.image_url ?? null,
      },
    });
  }
);

const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-from-clerk", event: "clerk/user.deleted" },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.deleteMany({
      where: { id: data.id },
    });
  }
);

const syncUserUpdate = inngest.createFunction(
  { id: "update-user-from-clerk", event: "clerk/user.updated" },
  async ({ event }) => {
    const { data } = event;
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

    await prisma.user.updateMany({
      where: { id: data.id },
      data: {
        email: data?.email_addresses?.[0]?.email_address ?? "",
        name: fullName,
        image: data.profile_image_url ?? data.image_url ?? null,
      },
    });
  }
);

export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdate];