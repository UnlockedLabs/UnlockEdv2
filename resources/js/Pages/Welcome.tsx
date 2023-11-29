import { Head } from '@inertiajs/react';
import { Button, Card, CardBody, Divider, Image, Link, Navbar, NavbarBrand, NavbarContent, NavbarItem, Slider, Spacer } from '@nextui-org/react';
import { PageProps } from '@/types';
import ApplicationLogo from '@/Components/ApplicationLogo';


export default function Welcome({ auth }: PageProps) {
    return (
        <>
            <Head title="Welcome" />
            <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
                <>
                    <Navbar className="bg-slate-900 border-b-1 border-slate-800">
                        <ApplicationLogo className="h-7" />
                        <NavbarBrand className="text-2xl">
                            <span className="text-teal-100">Unlock</span><span className="text-teal-400">Ed</span><span className="text-slate-500">v2</span>
                        </NavbarBrand>
                        {!auth.user ? (
                            <NavbarContent justify="end">
                                <NavbarItem className="hidden lg:flex">
                                    <Link
                                        href={route('login')}
                                        className="font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white focus:outline focus:outline-2 focus:rounded-sm focus:outline-teal-500"
                                    >
                                        Log in
                                    </Link>
                                </NavbarItem>
                                <NavbarItem>
                                    <Link
                                        href={route('register')}
                                        className="ms-4 font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white focus:outline focus:outline-2 focus:rounded-sm focus:outline-teal-500"
                                    >
                                        Register
                                    </Link>
                                </NavbarItem>
                            </NavbarContent>
                        ) : (
                            <NavbarContent justify="end">
                                <NavbarItem>
                                    <Link
                                        href={route('dashboard')}
                                        className="ms-4 font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white focus:outline focus:outline-2 focus:rounded-sm focus:outline-teal-500"
                                    >
                                        Dashboard
                                    </Link>
                                </NavbarItem>
                            </NavbarContent>
                        )}
                    </Navbar>
                    <div className="flex justify-center pt-10">
                        <div className="flex flex-col">
                            <Card
                                isBlurred
                                className="border-none bg-background/60 dark:bg-black/50 max-w-[810px]"
                                shadow="md"
                            >
                                <CardBody>
                                    <div className="grid grid-cols-6 md:grid-cols-12 gap-6 md:gap-4 items-center justify-center">
                                        <div className="relative col-span-6 md:col-span-4">
                                            <Image
                                                alt="Album cover"
                                                className="object-cover"
                                                height={200}
                                                shadow="md"
                                                src="/portrait-1.png"
                                                width="100%"
                                            />
                                        </div>
                                        <div className="col-span-8 justify-center text-slate-200 text-3xl p-8">
                                            A better justice system, <span className="text-teal-200">built from the inside</span>, out...
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                            <Spacer y={20} />
                            <h1 className="text-4xl font-semibold text-slate-300 pb-2">Our Story</h1>
                            <div className="text-slate-500 text-xl max-w-[810px] text-justify">
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Tellus pellentesque eu tincidunt tortor aliquam. Mi in nulla posuere sollicitudin aliquam ultrices sagittis orci. Ut consequat semper viverra nam libero justo. Facilisi cras fermentum odio eu. Amet commodo nulla facilisi nullam vehicula ipsum.
                            </div>
                            <Spacer y={10} />
                            <Image
                                src="/unlockedv1.png"
                                width={800}
                                className="object-cover"
                                shadow="md"
                            />
                            <Spacer y={10} />
                            <div className="text-slate-500 text-xl max-w-[810px] text-justify">
                                Id neque aliquam vestibulum morbi blandit cursus. Et egestas quis ipsum suspendisse ultrices gravida. Dictum fusce ut placerat orci nulla. Eu mi bibendum neque egestas. Etiam erat velit scelerisque in dictum. Viverra nibh cras pulvinar mattis nunc sed blandit libero volutpat. Porta nibh venenatis cras sed felis eget velit aliquet sagittis. Eleifend mi in nulla posuere sollicitudin aliquam ultrices sagittis orci.
                            </div>
                            <Spacer y={10} />
                        </div>
                    </div>
                </>
            </div>
        </>
    );
}
