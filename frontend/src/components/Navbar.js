// src/components/Navbar.jsx
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export default function Navbar() {
	return (
		<header className="border-b bg-white px-6 py-3 flex items-center justify-between">
			<a href="/" className="font-bold text-xl">
				MyApp
			</a>

			<NavigationMenu.Root>
				<NavigationMenu.List className="flex gap-6 items-center">
					<NavigationMenu.Item>
						<a href="#features" className="hover:text-blue-600">
							Features
						</a>
					</NavigationMenu.Item>
					<NavigationMenu.Item>
						<a href="#pricing" className="hover:text-blue-600">
							Pricing
						</a>
					</NavigationMenu.Item>
					<NavigationMenu.Item>
						<a href="/login" className="hover:text-blue-600">
							Login
						</a>
					</NavigationMenu.Item>

					<NavigationMenu.Item>
						<DropdownMenu.Root>
							<DropdownMenu.Trigger className="hover:text-blue-600">
								More ▾
							</DropdownMenu.Trigger>
							<DropdownMenu.Content
								className="bg-white shadow-md rounded-lg p-2"
								sideOffset={5}
							>
								<DropdownMenu.Item className="p-2 hover:bg-gray-100 rounded">
									<a href="/about">About</a>
								</DropdownMenu.Item>
								<DropdownMenu.Item className="p-2 hover:bg-gray-100 rounded">
									<a href="/contact">Contact</a>
								</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</NavigationMenu.Item>
				</NavigationMenu.List>
			</NavigationMenu.Root>
		</header>
	);
}
