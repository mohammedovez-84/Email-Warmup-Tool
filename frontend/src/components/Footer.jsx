import { motion } from 'framer-motion';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-gray-50">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col md:flex-row justify-between items-center"
                >
                    {/* <div className="flex space-x-6 mb-4 md:mb-0">
                        <a href="#" className="text-gray-500 hover:text-gray-700">
                            Terms
                        </a>
                        <a href="#" className="text-gray-500 hover:text-gray-700">
                            Privacy
                        </a>
                        <a href="#" className="text-gray-500 hover:text-gray-700">
                            Contact
                        </a>
                    </div> */}
                    {/* <p className="text-gray-500 text-sm">
                        &copy; {currentYear} EmailWarmup. All rights reserved.
                    </p> */}
                </motion.div>
            </div>
        </footer>
    );
}