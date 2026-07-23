"use client";

import { motion } from "framer-motion";

export function Floating({
    children,
}:{
    children:React.ReactNode
}){

    return(

        <motion.div

            animate={{
                y:[0,-10,0]
            }}

            transition={{
                duration:4,
                repeat:Infinity,
                ease:"easeInOut"
            }}

        >

            {children}

        </motion.div>

    )

}