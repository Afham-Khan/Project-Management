import { Inngest } from "inngest";
import prisma from "../config/prisma.js";

export const inngest = new Inngest({ id: "Project-Management" });

// Prisma schema has `name String` and `image String` (both NOT NULL),
// so never pass null for them.
const buildUserFields = (data) => {
  const email = data?.email_addresses?.[0]?.email_address ?? "";
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ");
  return {
    email,
    name: fullName || email.split("@")[0] || "User",
    image: data.image_url ?? data.profile_image_url ?? "",
  };
};

// Inngest v4: triggers go in the FIRST argument as `triggers`, handler is the second.
const syncUserCreation = inngest.createFunction(
  { id: "Sync-user-from-clerk", triggers: [{ event: "clerk/user.created" }] },
  async ({ event }) => {
    const { data } = event;
    const fields = buildUserFields(data);

    await prisma.user.upsert({
      where: { id: data.id },
      update: fields,
      create: { id: data.id, ...fields },
    });
  }
);

const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-from-clerk", triggers: [{ event: "clerk/user.deleted" }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.deleteMany({
      where: { id: data.id },
    });
  }
);

const syncUserUpdate = inngest.createFunction(
  { id: "update-user-from-clerk", triggers: [{ event: "clerk/user.updated" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.user.updateMany({
      where: { id: data.id },
      data: buildUserFields(data),
    });
  }
);

export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdate];
