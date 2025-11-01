"use client";

import { useNotificationStore } from "@/app/store/notificationStore";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => removeNotification(n.id)}
            className={`cursor-pointer rounded-lg px-4 py-3 shadow-md text-sm font-medium
              ${n.isFailed
                ? "bg-rose-100 text-rose-700 border border-rose-300"
                : "bg-emerald-100 text-emerald-700 border border-emerald-300"
              }`}
          >
            {n.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
