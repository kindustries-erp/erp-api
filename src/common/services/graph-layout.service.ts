import { Injectable } from '@nestjs/common';
import ELK from 'elkjs/lib/elk.bundled';

export interface GraphLayoutNode {
  id: string;
  width?: number;
  height?: number;
  module?: string;
  date?: string;
  data?: any;
}

export interface GraphLayoutEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface GraphLayoutResult {
  nodes: any[];
  edges: any[];
}

@Injectable()
export class GraphLayoutService {
  async calculateSwimlaneLayout(
    nodes: GraphLayoutNode[],
    edges: GraphLayoutEdge[],
  ): Promise<GraphLayoutResult> {
    const elk = new ELK();

    // 1. Create a flat layout graph
    const moduleGroups = [
      ...new Set(nodes.map((n) => n.module).filter(Boolean)),
    ];

    const children = moduleGroups.map((mod) => ({
      id: `group-${mod}`,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.padding': '[top=100,left=50,bottom=50,right=50]',
        'elk.spacing.nodeNode': '150', // vertical spacing inside groups
        'elk.layered.spacing.nodeNodeBetweenLayers': '150', // horizontal spacing between child nodes
      },
      children: nodes
        .filter((n) => n.module === mod)
        .map((n) => ({
          id: n.id,
          width: n.width || 360, // Increased width to add horizontal space
          height: n.height || 200, // Increased height to add vertical space
          originalData: n,
        })),
    }));

    // Wrap the groups in a single parent that stacks them vertically
    const groupWrapper = {
      id: 'group-all',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN', // Stack vertically
        'elk.padding': '[top=20,left=20,bottom=20,right=20]',
        'elk.spacing.nodeNode': '200', // Increased spacing between the groups
      },
      children: children,
    };

    const rootNodes = nodes
      .filter((n) => !n.module)
      .map((n) => ({
        id: n.id,
        width: n.width || 360,
        height: n.height || 200,
        originalData: n,
      }));

    const elkGraph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT', // Root flows from left to right (Item -> Wrapper)
        'elk.spacing.nodeNode': '200',
        'elk.layered.spacing.nodeNodeBetweenLayers': '240',
      },
      children: [groupWrapper, ...rootNodes],
      edges: edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    const layouted = await elk.layout(elkGraph);

    const resultNodes: any[] = [];
    const resultEdges: any[] = [];

    layouted.children?.forEach((c) => {
      if (c.id === 'group-all') {
        // Iterate through its children (the actual groups)
        c.children?.forEach((group) => {
          // Add the group node
          resultNodes.push({
            id: group.id,
            type: 'groupNode',
            position: {
              x: (c.x || 0) + (group.x || 0),
              y: (c.y || 0) + (group.y || 0),
            },
            style: { width: group.width, height: group.height },
            data: { label: group.id.replace('group-', '') },
          });

          // Add the children inside the group
          group.children?.forEach((child) => {
            resultNodes.push({
              id: child.id,
              type: 'graphNode',
              parentId: group.id,
              position: { x: child.x || 0, y: child.y || 0 },
              data: { ...(child as any).originalData.data },
            });
          });
        });
      } else {
        // It's a root node (like the item)
        resultNodes.push({
          id: c.id,
          type: 'graphNode',
          position: { x: c.x || 0, y: c.y || 0 },
          data: { ...(c as any).originalData.data },
        });
      }
    });

    edges.forEach((e) => {
      resultEdges.push({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: true,
        style: { strokeDasharray: '5 5', strokeWidth: 2 },
        label: e.label,
      });
    });

    return {
      nodes: resultNodes,
      edges: resultEdges,
    };
  }
}
