import Utility from "Utility"; // Assuming Utility is a module; adjust if global

const Armlet = {};

const option = Menu.AddOption(["Item Specific", "Armlet"], "Auto Toggle", "On/Off");
const optionFarmMode = Menu.AddOption(["Item Specific", "Armlet"], "Farming Mode", "Toggle on armlet when farming (On/Off)");
const safeThreshold: number = 550;
const dangerousThreshold: number = 100;
let lasttime: number = GameRules.GetGameTime();
const msg_queue: number[] = [];

// List of dangerous DoT modifiers to monitor (e.g., Urn of Shadows, Spirit Vessel, etc.)
const dangerousModifiers: string[] = [
    "modifier_item_urn_damage",  // Urn of Shadows damage
    "modifier_item_spirit_vessel_damage",  // Spirit Vessel damage
    // Add more if needed, like "modifier_ice_blast" for AA ult, etc.
];

Armlet.OnPrepareUnitOrders = (orders: any): boolean => {
    if (!Menu.IsEnabled(option)) return true;
    if (!orders) return true;
    const myHero = Heroes.GetLocal();
    if (!myHero) return true;
    if (!Utility.IsSuitableToUseItem(myHero)) return true;
    const item = NPC.GetItem(myHero, "item_armlet", true);
    if (!item) return true;
    const current = GameRules.GetGameTime();
    // toggle on armlet if about to attack
    if (!Ability.GetToggleState(item) && (orders.order === Enum.UnitOrder.DOTA_UNIT_ORDER_ATTACK_MOVE || orders.order === Enum.UnitOrder.DOTA_UNIT_ORDER_ATTACK_TARGET)) {
        // disable auto farm mode if the option is turned off
        if (!Menu.IsEnabled(optionFarmMode) && orders.target && NPC.IsCreep(orders.target)) {
            return true;
        }
        Ability.Toggle(item);
        lasttime = current;
    }
    // toggle off armlet if about to walk
    if (Ability.GetToggleState(item) && Entity.GetHealth(myHero) >= safeThreshold && (orders.order === Enum.UnitOrder.DOTA_UNIT_ORDER_MOVE_TO_POSITION || orders.order === Enum.UnitOrder.DOTA_UNIT_ORDER_MOVE_TO_TARGET)) {
        Ability.Toggle(item);
        lasttime = current;
    }
    return true;
};

Armlet.OnUpdate = (): void => {
    if (!Menu.IsEnabled(option)) return;
    const myHero = Heroes.GetLocal();
    if (!myHero) return;
    if (!Utility.IsSuitableToUseItem(myHero)) return;
    const item = NPC.GetItem(myHero, "item_armlet", true);
    if (!item) return;
    const current = GameRules.GetGameTime();
    if (Entity.GetHealth(myHero) <= dangerousThreshold && current - lasttime > 0.6) {
        Armlet.Toggle();
    }
    if (!msg_queue || msg_queue.length <= 0) return;
    const timestamp = msg_queue.shift()!;
    const err = 0.05;
    if (Math.abs(timestamp - current) <= err) {
        Ability.Toggle(item);
        lasttime = current;
    } else if (timestamp > current + err) {
        msg_queue.push(timestamp);
    }
};

// right click from range units (range creep, range hero, tower)
Armlet.OnProjectile = (projectile: any): void => {
    if (!Menu.IsEnabled(option)) return;
    if (!projectile || !projectile.source || !projectile.target) return;
    if (!projectile.isAttack) return;
    const myHero = Heroes.GetLocal();
    if (!myHero) return;
    if (projectile.target !== myHero) return;
    if (Entity.IsSameTeam(projectile.source, myHero)) return;
    const true_damage = NPC.GetTrueDamage(projectile.source) * NPC.GetArmorDamageMultiplier(myHero);
    if (true_damage + dangerousThreshold >= Entity.GetHealth(myHero) && Entity.GetHealth(myHero) > dangerousThreshold) {
        Armlet.Toggle();
    }
};

// right click from melee units
Armlet.OnUnitAnimation = (animation: any): void => {
    if (!Menu.IsEnabled(option)) return;
    if (!animation || !animation.sequenceName || !animation.unit) return;
    const myHero = Heroes.GetLocal();
    if (!myHero) return;
    if (Entity.IsSameTeam(animation.unit, myHero)) return;
    if (NPC.IsRanged(animation.unit)) return;
    if (!NPC.IsEntityInRange(myHero, animation.unit, 150)) return;
    const true_damage = NPC.GetTrueDamage(animation.unit) * NPC.GetArmorDamageMultiplier(myHero);
    if (true_damage + dangerousThreshold >= Entity.GetHealth(myHero) && Entity.GetHealth(myHero) > dangerousThreshold) {
        Armlet.Toggle();
    }
};

// New: Handler for modifier created to abuse DoT effects
Armlet.OnModifierCreate = (modifier: any): void => {
    if (!Menu.IsEnabled(option)) return;
    const myHero = Heroes.GetLocal();
    if (!myHero) return;
    if (!modifier || !Entity.IsHero(modifier.GetParent()) || modifier.GetParent() !== myHero) return;
    
    const modName = modifier.GetName();
    if (!dangerousModifiers.includes(modName)) return;
    
    // Assuming we can get remaining time and tick period from modifier
    // Note: In real Dota scripting, you might need to hardcode tick periods as API may vary.
    // For Urn/Spirit Vessel, tick every 1 second, damage per tick is fixed or based on stacks.
    const remainingTime = modifier.GetRemainingTime();  // Total duration left
    const elapsedTime = modifier.GetElapsedTime();  // Time since applied
    const tickPeriod = 1.0;  // Assume 1 second for Urn/Vessel; adjust per modifier if needed
    
    // Calculate next tick time: DoTs usually tick immediately on apply, then every period.
    // So next tick at current + (tickPeriod - (elapsedTime % tickPeriod))
    const current = GameRules.GetGameTime();
    const timeSinceLastTick = elapsedTime % tickPeriod;
    const timeToNextTick = tickPeriod - timeSinceLastTick;
    
    // Estimate damage per tick (hardcode or calculate; for simplicity, assume we know approx)
    // For Urn: 5% max HP over 8 sec, but actually it's flat + %; but for abuse, we check HP threshold.
    const approxTickDamage = 30;  // Placeholder; in real script, use better estimation.
    
    // If current HP is low, schedule abuse toggles for each upcoming tick
    if (Entity.GetHealth(myHero) < 400) {
        const numTicksLeft = Math.floor(remainingTime / tickPeriod);
        for (let i = 1; i <= numTicksLeft; i++) {
            const tickTime = current + timeToNextTick + (i - 1) * tickPeriod;
            // Schedule toggle ON just before tick (e.g., 0.05 sec before) to gain HP bonus
            msg_queue.push(tickTime - 0.05);
            // Schedule toggle OFF right after tick to minimize drain
            msg_queue.push(tickTime + 0.05);
        }
    }
};

Armlet.Toggle = (): void => {
    const myHero = Heroes.GetLocal();
    if (!myHero) return;
    const item = NPC.GetItem(myHero, "item_armlet", true);
    if (!item) return;
    const current = GameRules.GetGameTime();
    if (Ability.GetToggleState(item)) {
        msg_queue.push(current);
        msg_queue.push(current + 0.1);
    } else {
        msg_queue.push(current);
    }
};

export default Armlet;
