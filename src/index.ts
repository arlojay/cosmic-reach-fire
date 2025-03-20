import { addDefaultEvents, BlockEventPredicate, Directions, LogicPredicate, Mod, RandomPredicate, ReplaceBlockStateAction, RunTriggerAction, SetBlockStateParamsAction, Texture, UpdateBlockAction, Writer } from "cosmic-reach-dag";

const mod = new Mod("fire");
const writer = new Writer(mod, true);

main();

async function main() {
    const flammableTags = [
        "tool_axe_effective"
    ];
    const nonFlammableTags = [
        "tool_pickaxe_effective",
        "tool_shovel_effective"
    ];

    const block = mod.createBlock("fire");
    const sheet = mod.createTriggerSheet("fire");
    sheet.onUpdate(
        new SetBlockStateParamsAction({
            params: { north: "false", east: "false", south: "false", west: "false", up: "false", down: "false" }
        })
    );

    addDefaultEvents(sheet);
    sheet.addTrigger("onPlace", new RunTriggerAction({ triggerId: "onFireSpread" }));



    for(const direction of Directions.cardinals) {
        sheet.onUpdate(
            new SetBlockStateParamsAction({
                params: { [direction.name]: "true" }
            })
            .if(new LogicPredicate({
                or: [
                    new BlockEventPredicate({
                        block_at: {
                            xOff: direction.x, yOff: direction.y, zOff: direction.z,
                            
                            has_tag: "flammable"
                        }
                    }),
                    new LogicPredicate({
                        and: [
                            new LogicPredicate({
                                or: flammableTags.map(tag => new BlockEventPredicate({
                                    block_at: {
                                        xOff: direction.x, yOff: direction.y, zOff: direction.z,

                                        has_tag: tag
                                    }
                                }))
                            }),
                            new LogicPredicate({
                                not: new LogicPredicate({
                                    or: nonFlammableTags.map(tag => new BlockEventPredicate({
                                        block_at: {
                                            xOff: direction.x, yOff: direction.y, zOff: direction.z,
            
                                            has_tag: tag
                                        }
                                    }))
                                })
                            })
                        ]
                    })
                ]
            })
        ))
    }

    sheet.onUpdate(
        new ReplaceBlockStateAction({
            blockStateId: "base:air[default]"
        })
        .if(new LogicPredicate({
            and: Directions.cardinals.array().map(direction => new BlockEventPredicate({
                srcBlockState: {
                    has_param: { param: direction.name, value: "false" }
                }
            }))
        }))
    );

    sheet.addTrigger("onFireSpread",
        new SetBlockStateParamsAction({
            params: { state: "active" }
        }),
        new RunTriggerAction({
            triggerId: "spreadFire",
            tickDelay: 40
        }),
        new RunTriggerAction({
            triggerId: "tryDestroyBlocks",
            tickDelay: 20
        })
    )

    for(const direction of Directions.cardinals) {
        sheet.addTrigger("tryDestroyBlocks",
            new ReplaceBlockStateAction({
                xOff: direction.x, yOff: direction.y, zOff: direction.z,
                blockStateId: "base:air[default]"
            })
            .if(new LogicPredicate({
                and: [
                    new LogicPredicate({
                        random: new RandomPredicate({ normalChance: 0.1 })
                    }),                    
                    new BlockEventPredicate({
                        srcBlockState: {
                            has_param: { param: direction.name, value: "true" }
                        }
                    })
                ]
            }))
        )
    }

    sheet.addTrigger("tryDestroyBlocks",
        new UpdateBlockAction,
        new RunTriggerAction({
            triggerId: "tryDestroyBlocks",
            tickDelay: 5
        })
    )

    const radius = 2;
    for(let dx = -radius; dx <= radius; dx++) for(let dy = -radius; dy <= radius; dy++) for(let dz = -radius; dz <= radius; dz++) {
        if(dx == 0 && dy == 0 && dz == 0) continue;

        sheet.addTrigger("spreadFire",
            new ReplaceBlockStateAction({
                blockStateId: "fire:fire[north=true,south=true,east=true,west=true,up=true,down=true,state=inactive]",
                xOff: dx, yOff: dy, zOff: dz
            })
            .if(new LogicPredicate({
                and: [
                    new LogicPredicate({
                        random: new RandomPredicate({ normalChance: 0.2 }),
                    }),
                    new BlockEventPredicate({
                        block_at: {
                            xOff: dx, yOff: dy, zOff: dz,
                            has_tag: "replaceable"
                        }
                    })
                ]
            })),
            new UpdateBlockAction({ xOff: dx, yOff: dy, zOff: dz }),
            new RunTriggerAction({
                xOff: dx, yOff: dy, zOff: dz,
                triggerId: "onFireSpread"
            })
        )
    }

    const fireTexture = await Texture.loadFromFile("flame", "./assets/flame.png");

    block.fallbackParams = {
        catalogHidden: true,
        isOpaque: false
    }

    for(const directionList of Directions.cardinals.combinations()) {
        const north = directionList.hasDirection("north");
        const east = directionList.hasDirection("east");
        const south = directionList.hasDirection("south");
        const west = directionList.hasDirection("west");
        const up = directionList.hasDirection("up");
        const down = directionList.hasDirection("down");

        for(const activeState of [ "inactive", "active" ]) {
            const state = block.createState({
                north: north ? "true" : "false",
                east: east ? "true" : "false",
                south: south ? "true" : "false",
                west: west ? "true" : "false",
                up: up ? "true" : "false",
                down: down ? "true" : "false",
                state: activeState
            });
            state.setTriggerSheet(sheet);

            if(activeState == "active") {
                state.light = [ 15, 12, 6 ];
            }

            if(!north && !south && !east && !west && !up && down && activeState == "inactive") {
                state.catalogHidden = false;
            }

            const model = state.createBlockModel();
            model.usesTransparency = true;
            
            if(activeState == "active") {
                if(north) {
                    const cuboid = model.createCuboid();
                    cuboid.setSize(0, 0, 1, 16, 16, 1);
                    cuboid.south.texture = fireTexture;
                }
                if(south) {
                    const cuboid = model.createCuboid();
                    cuboid.setSize(0, 0, 15, 16, 16, 15);
                    cuboid.north.texture = fireTexture;
                }
                if(east) {
                    const cuboid = model.createCuboid();
                    cuboid.setSize(15, 0, 0, 15, 16, 16);
                    cuboid.west.texture = fireTexture;
                }
                if(west) {
                    const cuboid = model.createCuboid();
                    cuboid.setSize(1, 0, 0, 1, 16, 16);
                    cuboid.east.texture = fireTexture;
                }
                if(down) {
                    const cuboidA = model.createCuboid();
                    cuboidA.setSize(8, 0, 0, 8, 16, 16);
                    cuboidA.east.texture = fireTexture;
                    cuboidA.west.texture = fireTexture;
                    
                    const cuboidB = model.createCuboid();
                    cuboidB.setSize(0, 0, 8, 16, 16, 8);
                    cuboidB.north.texture = fireTexture;
                    cuboidB.south.texture = fireTexture;
                }
                if(up) {
                    const cuboid = model.createCuboid();
                    cuboid.setSize(0, 15, 0, 16, 15, 16);
                    cuboid.down.texture = fireTexture;
                }
            }
        }
    }

    writer.write(process.env.LOCALAPPDATA + "/cosmic-reach/mods/");
}