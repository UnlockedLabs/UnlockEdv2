import { ListBulletIcon, Squares2X2Icon } from "@heroicons/react/24/solid";

export enum ViewType {
  Grid = "Grid",
  List = "List",
}

export default function ToggleView({ activeView, setActiveView }: { activeView: ViewType, setActiveView: Function }) {

  return (
    <div className="flex flex-row items-center gap-2 body-small">
      <label>View</label>
      <div className="bg-teal-1 join p-1">
        {/* TO DO: come back and render on active or not */}
        <button
          className={`flex gap-2 px-3 py-1 items-center rounded-lg ${activeView == ViewType.Grid && "bg-background"}`}
          onClick={() => setActiveView(ViewType.Grid)}
        >
          <Squares2X2Icon className="h-4"></Squares2X2Icon> Grid
        </button>
        <button
          className={`flex gap-2 px-3 py-1 items-center rounded-lg ${activeView == ViewType.List && "bg-background"}`}
          onClick={() => setActiveView(ViewType.List)}
        >
          <ListBulletIcon className="h-4"></ListBulletIcon> List
        </button>
      </div>
    </div>
  )
}
