import { CompassIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ExplorePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-heading font-semibold text-lg">
        <CompassIcon className="size-5 opacity-80" />
        Explore
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Navigate the console</CardTitle>
          <CardDescription>
            Use the sidebar to move between product surfaces: live bounties, gateway
            diagnostics, resources, staking, solving, agent credits, and settings.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-wrap gap-2">
          <Button render={<Link to="/bounties" />}>Open bounty feed</Button>
          <Button render={<Link to="/agent" />} variant="outline">
            Agent credits
          </Button>
          <Button render={<Link to="/settings" />} variant="outline">
            Settings
          </Button>
        </CardPanel>
      </Card>
    </div>
  );
}
