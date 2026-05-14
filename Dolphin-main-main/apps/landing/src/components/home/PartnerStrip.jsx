import { motion } from "framer-motion";

const MotionDiv = motion.div;

export default function PartnerStrip({ partners }) {
  const repeatedPartners = [...partners, ...partners];

  return (
    <div className="partner-strip">
      <MotionDiv
        animate={{ x: ["0%", "-50%"] }}
        className="partner-strip__track"
        transition={{ duration: 20, ease: "linear", repeat: Infinity }}
      >
        {repeatedPartners.map((partner, index) => (
          <div key={`${partner}-${index}`} className="partner-strip__item">
            <span>{partner}</span>
          </div>
        ))}
      </MotionDiv>
    </div>
  );
}
