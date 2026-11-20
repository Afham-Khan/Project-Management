import { Inngest } from "inngest";
import prisma from '../configs/prisma.js'

// Create a client to send and receive events
export const inngest = new Inngest({ id: "Project-Management" });

// Create ingest fnc 

const syncUserCreation = inngest.createFunction(
  { id: "Sync-user-from-clerk", event: "clerk/user.created" },
  async ({ event }) => {
    const { data } = event;
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

    await prisma.user.create({
      data: {
        id: data.id,
        email: data?.email_addresses?.[0]?.email_address ?? "",
        name: fullName,
        image: data.profile_image_url ?? data.image_url ?? null,
      },
    });
  }
);

// delete user from database when user is deleted from clerk
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-from-clerk", event: "clerk/user.deleted" },
    async ({ event }) => {
    const { data } = event;
    await prisma.user.delete({
      where: {
        id: data.id,
        },
    });
  }     
)

// update user in database when user is updated in clerk
const syncUserUpdate = inngest.createFunction(
  { id: "update-user-from-clerk", event: "clerk/user.updated" },
    async ({ event }) => {
    const { data } = event;
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
    await prisma.user.update({
      where: {
        id: data.id,
      },
      data: {
        email: data?.email_addresses[0]?.email_address,
        name: fullName,
        image: data.profile_image_url ?? data.image_url ?? null,
      },
    });
  }
);

// Create an empty array where we'll export future Inngest functions
export const functions = [ syncUserCreation, syncUserDeletion, syncUserUpdate ];