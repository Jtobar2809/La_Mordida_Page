"use client";

import { motion } from "framer-motion";

export function HoverScale({

    children,

}:{

    children:React.ReactNode

}){

    return(

        <motion.div

            whileHover={{

                scale:1.03,

                y:-4,

            }}

            transition={{

                duration:.2

            }}

        >

            {children}

        </motion.div>

    )

}