// frontend/src/app/(authenticated)/admin/ui-sandbox/page.tsx
'use client';

import React, { useState } from 'react';

// Import the UI components you want to test
import { Button } from '@/components/ui/Button'; // Adjust path
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'; // Adjust path
import { Input } from '@/components/ui/Input'; // Adjust path
import { Label } from '@/components/ui/Label'; // Adjust path
// import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'; // Adjust path - Uncomment if using Select
import { Checkbox } from '@/components/ui/Checkbox'; // Adjust path
import Avatar from '@/components/Avatar'; // Adjust path
import Spinner from '@/components/ui/Spinner'; // Adjust path
// import ConfirmationModal from '@/components/Modal/ConfirmationModal'; // Adjust path - Uncomment if testing modals

// You might need context or other hooks if components depend on them
// import { useAuth } from '@/context/AuthContext';

export default function AdminUISandboxPage() {
    // Example state for interactive components
    const [inputValue, setInputValue] = useState('');
    const [isChecked, setIsChecked] = useState(false);
    // const [isModalOpen, setIsModalOpen] = useState(false); // For modal testing

    return (
        <div className="p-4 md:p-8 space-y-8">
            <h1 className="text-2xl font-bold mb-6">Admin UI Component Sandbox</h1>

            {/* --- Section for Buttons --- */}
            <section className="space-y-4 p-4 border rounded">
                <h2 className="text-xl font-semibold mb-3">Buttons</h2>
                <div className="flex flex-wrap gap-4 items-center">
                {/* Change 'default' to your actual primary variant, e.g., 'primary' */}
                <Button variant="primary">Primary</Button> {/* <<< ADJUSTED */}
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                {/* Remove 'link' variant if it doesn't exist */}
                {/* <Button variant="link">Link</Button> */} {/* <<< REMOVED/COMMENTED */}
                <Button disabled>Disabled</Button>
                <Button isLoading>Loading</Button> {/* Assuming your Button supports isLoading */}
                <Button size="sm">Small</Button> {/* Size prop might also need adjusting */}
                <Button size="lg">Large</Button> {/* Size prop might also need adjusting */}
            </div>
            </section>

            {/* --- Section for Cards --- */}
            <section className="space-y-4 p-4 border rounded">
                 <h2 className="text-xl font-semibold mb-3">Cards</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="dark:bg-gray-800 border border-gray-700"> {/* Apply base styles */}
                        <CardHeader>
                             <CardTitle>Standard Card</CardTitle>
                         </CardHeader>
                         <CardContent>
                             <p>This is the content area of a standard card.</p>
                         </CardContent>
                         <CardFooter>
                             <Button size="sm">Card Action</Button>
                         </CardFooter>
                     </Card>
                    <Card className="dark:bg-blue-900/30 border border-blue-700"> {/* Example variation */}
                        <CardHeader>
                             <CardTitle>Colored Card</CardTitle>
                         </CardHeader>
                         <CardContent>
                             <p>This card has a different background/border.</p>
                         </CardContent>
                    </Card>
                </div>
            </section>

             {/* --- Section for Inputs & Labels --- */}
             <section className="space-y-4 p-4 border rounded max-w-md">
                 <h2 className="text-xl font-semibold mb-3">Inputs & Labels</h2>
                 <div className="space-y-2">
                     <Label htmlFor="text-input">Text Input</Label>
                     <Input
                        id="text-input"
                        type="text"
                        placeholder="Enter text..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                    />
                 </div>
                 <div className="space-y-2">
                     <Label htmlFor="email-input">Email Input</Label>
                     <Input id="email-input" type="email" placeholder="Enter email..." />
                 </div>
                 <div className="space-y-2">
                     <Label htmlFor="disabled-input">Disabled Input</Label>
                     <Input id="disabled-input" type="text" placeholder="Disabled" disabled />
                 </div>
             </section>

             {/* --- Section for Checkboxes --- */}
            <section className="space-y-4 p-4 border rounded">
                <h2 className="text-xl font-semibold mb-3">Checkboxes</h2>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="checkbox-1"
                        checked={isChecked}
                        onCheckedChange={(checked) => setIsChecked(checked === true)} // Handle boolean conversion
                    />
                    <Label htmlFor="checkbox-1">Interactive Checkbox</Label>
                </div>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="checkbox-2" checked={true} disabled />
                    <Label htmlFor="checkbox-2">Disabled Checked</Label>
                </div>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="checkbox-3" checked={false} disabled />
                    <Label htmlFor="checkbox-3">Disabled Unchecked</Label>
                </div>
            </section>

             {/* --- Section for Avatars --- */}
             <section className="space-y-4 p-4 border rounded">
                 <h2 className="text-xl font-semibold mb-3">Avatars</h2>
                 <div className="flex flex-wrap gap-4 items-center">
                     <Avatar name="Dave Smith" size="xs" />
                     <Avatar name="Jane Doe" size="sm" />
                     <Avatar name="Test User" size="md" />
                     <Avatar name="Admin A" size="lg" />
                     <Avatar name="No Image" size="md" /> {/* Example without URL */}
                     {/* Add example with actual URL if your component supports it */}
                     {/* <Avatar name="With Image" size="md" fullAvatarUrl="/path/to/image.png" /> */}
                 </div>
             </section>

             {/* --- Section for Spinners --- */}
             <section className="space-y-4 p-4 border rounded">
                 <h2 className="text-xl font-semibold mb-3">Spinners</h2>
                 <div className="flex flex-wrap gap-4 items-center">
                 <Spinner className="h-4 w-4" /> {/* <<< ADJUSTED */}
                <Spinner className="h-6 w-6" /> {/* <<< ADJUSTED (Default?) */}
                <Spinner className="h-8 w-8" /> {/* <<< ADJUSTED */}
                <span className="text-sm">Small (h-4 w-4)</span>
                <span className="text-base">Medium (h-6 w-6)</span>
                <span className="text-lg">Large (h-8 w-8)</span>
                 </div>
             </section>

            {/* --- Add Sections for other components like Select, Modal, Table etc. as needed --- */}
            {/* Example Modal Trigger */}
            {/*
            <section className="space-y-4 p-4 border rounded">
                <h2 className="text-xl font-semibold mb-3">Modals</h2>
                <Button onClick={() => setIsModalOpen(true)}>Open Confirmation</Button>
                <ConfirmationModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onConfirm={() => { alert('Confirmed!'); setIsModalOpen(false); }}
                    title="Test Confirmation"
                    message="This is a test message for the modal."
                    confirmText="Confirm Test"
                 />
            </section>
            */}

        </div>
    );
}