import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

export default function PageTransition() {
  const { pathname } = useLocation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="page-transition"
        initial={
          prefersReducedMotion ? false : { opacity: 0, y: 10 }
        }
        animate={{ opacity: 1, y: 0 }}
        exit={
          prefersReducedMotion ? undefined : { opacity: 0, y: -6 }
        }
        transition={{
          duration: prefersReducedMotion ? 0.01 : 0.24,
          ease: "easeOut",
        }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
